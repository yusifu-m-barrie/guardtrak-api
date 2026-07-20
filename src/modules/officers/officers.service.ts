import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditAction,
  OfficerEmploymentStatus,
  Prisma,
  UserRole,
} from '../../../generated/prisma/client';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import {
  assertSameOrganisation,
  requireOrganisationId,
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import {
  normalizeCode,
  normalizeEmail,
  normalizeEmployeeId,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';
import type { CreateOfficerDto } from './dto/create-officer.dto';
import type { ListOfficersQueryDto } from './dto/list-officers-query.dto';
import type { UpdateOfficerDto } from './dto/update-officer.dto';
import type { UpdateOfficerEmploymentStatusDto } from './dto/update-officer-employment-status.dto';
import type { UpdateOfficerSelfDto } from './dto/update-officer-self.dto';
import {
  mapOfficerDetail,
  mapOfficerMe,
  OFFICER_USER_SELECT,
} from './mappers/officer.mapper';

const OFFICER_SORT_FIELDS = [
  'createdAt',
  'officerNumber',
  'hireDate',
  'updatedAt',
] as const;

const OFFICER_INCLUDE = {
  user: { select: OFFICER_USER_SELECT },
} satisfies Prisma.OfficerProfileInclude;

const OFFICER_ME_INCLUDE = (now = new Date()) =>
  ({
    user: { select: OFFICER_USER_SELECT },
    organisation: true,
    supervisorLinks: {
      where: {
        OR: [{ activeUntil: null }, { activeUntil: { gt: now } }],
      },
      include: {
        supervisor: {
          include: {
            user: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    },
  }) satisfies Prisma.OfficerProfileInclude;

export interface AuditContext {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class OfficersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly authAuditService: AuthAuditService,
  ) {}

  async create(actor: RequestUser, dto: CreateOfficerDto, audit: AuditContext) {
    const organisationId = requireOrganisationId(actor);
    const employeeId = normalizeEmployeeId(dto.user.employeeId);
    const email = normalizeEmail(dto.user.email);
    const phone = normalizePhone(dto.user.phone);
    const officerNumber = normalizeCode(dto.profile.officerNumber);
    const firstName = normalizePersonName(dto.user.firstName);
    const lastName = normalizePersonName(dto.user.lastName);
    const middleName = trimOrUndefined(dto.user.middleName)
      ? normalizePersonName(dto.user.middleName!)
      : null;

    this.passwordService.assertPolicy(dto.user.temporaryPassword);
    const passwordHash = await this.passwordService.hash(
      dto.user.temporaryPassword,
    );

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organisationId,
            employeeId,
            email,
            phone,
            passwordHash,
            firstName,
            middleName,
            lastName,
            role: UserRole.SECURITY_OFFICER,
            status: 'ACTIVE',
            mustChangePassword: true,
          },
          select: OFFICER_USER_SELECT,
        });

        const profile = await tx.officerProfile.create({
          data: {
            organisationId,
            userId: user.id,
            officerNumber,
            employmentStatus:
              dto.profile.employmentStatus ?? OfficerEmploymentStatus.ACTIVE,
            hireDate: dto.profile.hireDate
              ? new Date(dto.profile.hireDate)
              : null,
            nationalIdNumber:
              trimOrUndefined(dto.profile.nationalIdNumber) ?? null,
            dateOfBirth: dto.profile.dateOfBirth
              ? new Date(dto.profile.dateOfBirth)
              : null,
            gender: trimOrUndefined(dto.profile.gender) ?? null,
            residentialAddress:
              trimOrUndefined(dto.profile.residentialAddress) ?? null,
            emergencyContactName:
              trimOrUndefined(dto.profile.emergencyContactName) ?? null,
            emergencyContactPhone:
              normalizePhone(dto.profile.emergencyContactPhone) ?? null,
            emergencyContactRelationship:
              trimOrUndefined(dto.profile.emergencyContactRelationship) ?? null,
            rankOrTitle: trimOrUndefined(dto.profile.rankOrTitle) ?? null,
            skills: (dto.profile.skills as Prisma.InputJsonValue) ?? undefined,
            notes: trimOrUndefined(dto.profile.notes) ?? null,
          },
          include: OFFICER_INCLUDE,
        });

        return profile;
      });

      await this.authAuditService.record({
        organisationId,
        actorUserId: actor.id,
        action: AuditAction.CREATE,
        entityType: 'OfficerProfile',
        entityId: result.id,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        metadata: {
          userId: result.userId,
          officerNumber: result.officerNumber,
        },
      });

      return mapOfficerDetail(result, { includeNotes: true });
    } catch (error) {
      this.handleCreateError(error);
    }
  }

  async list(actor: RequestUser, query: ListOfficersQueryDto) {
    const organisationId = requireOrganisationId(actor);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      OFFICER_SORT_FIELDS,
      'createdAt',
    );
    const sortOrder = query.sortOrder ?? 'desc';
    const where = await this.buildListWhere(actor, organisationId, query);

    const orderBy = this.buildOrderBy(sortBy ?? 'createdAt', sortOrder);

    const [items, total] = await Promise.all([
      this.prisma.officerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: OFFICER_INCLUDE,
      }),
      this.prisma.officerProfile.count({ where }),
    ]);

    return {
      data: items.map((item) =>
        mapOfficerDetail(item, {
          includeNotes: actor.role === AppUserRole.ADMINISTRATOR,
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getMe(actor: RequestUser) {
    const organisationId = requireOrganisationId(actor);
    const profile = await this.prisma.officerProfile.findFirst({
      where: {
        organisationId,
        userId: actor.id,
        deletedAt: null,
      },
      include: OFFICER_ME_INCLUDE(),
    });

    if (!profile) {
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }

    return mapOfficerMe(profile);
  }

  async updateMe(
    actor: RequestUser,
    dto: UpdateOfficerSelfDto,
    audit: AuditContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.prisma.officerProfile.findFirst({
      where: {
        organisationId,
        userId: actor.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) {
      userData.email = normalizeEmail(dto.email) ?? null;
    }
    if (dto.phone !== undefined) {
      userData.phone = normalizePhone(dto.phone) ?? null;
    }
    if (dto.avatarUrl !== undefined) {
      userData.avatarUrl = trimOrUndefined(dto.avatarUrl) ?? null;
    }

    const profileData: Prisma.OfficerProfileUpdateInput = {};
    if (dto.emergencyContactName !== undefined) {
      profileData.emergencyContactName =
        trimOrUndefined(dto.emergencyContactName) ?? null;
    }
    if (dto.emergencyContactPhone !== undefined) {
      profileData.emergencyContactPhone =
        normalizePhone(dto.emergencyContactPhone) ?? null;
    }

    if (
      Object.keys(userData).length === 0 &&
      Object.keys(profileData).length === 0
    ) {
      throw new AppException(
        'No updatable fields provided',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: existing.userId },
            data: userData,
          });
        }
        if (Object.keys(profileData).length > 0) {
          await tx.officerProfile.update({
            where: { id: existing.id },
            data: profileData,
          });
        }
      });

      await this.authAuditService.record({
        organisationId,
        actorUserId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'OfficerProfile',
        entityId: existing.id,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        metadata: {
          selfUpdate: true,
          changedFields: [
            ...Object.keys(userData),
            ...Object.keys(profileData),
          ],
        },
      });

      return this.getMe(actor);
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  async getById(actor: RequestUser, officerId: string) {
    if (
      !userHasPermission(actor, 'officer:read') &&
      !userHasPermission(actor, 'officer:read:self') &&
      !userHasPermission(actor, 'officer:read:assigned')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const organisationId = requireOrganisationId(actor);
    const profile = await this.findOfficerForAccess(
      actor,
      organisationId,
      officerId,
    );

    return mapOfficerDetail(profile, {
      includeNotes: actor.role === AppUserRole.ADMINISTRATOR,
    });
  }

  async update(
    actor: RequestUser,
    officerId: string,
    dto: UpdateOfficerDto,
    audit: AuditContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findOfficerOrNotFound(
      organisationId,
      officerId,
    );
    const profileData = this.buildProfileUpdateData(dto.profile, true);
    const userData = this.buildUserUpdateData(dto.user);

    if (!profileData && !userData) {
      throw new AppException(
        'No updatable fields provided',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (userData) {
          await tx.user.update({
            where: { id: existing.userId },
            data: userData,
          });
        }

        if (profileData) {
          await tx.officerProfile.update({
            where: { id: existing.id },
            data: profileData,
          });
        }

        return tx.officerProfile.findFirstOrThrow({
          where: { id: existing.id },
          include: OFFICER_INCLUDE,
        });
      });

      await this.authAuditService.record({
        organisationId,
        actorUserId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'OfficerProfile',
        entityId: updated.id,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        metadata: {
          changedFields: [
            ...(userData ? Object.keys(userData) : []),
            ...(profileData ? Object.keys(profileData) : []),
          ],
        },
      });

      return mapOfficerDetail(updated, { includeNotes: true });
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  async updateEmploymentStatus(
    actor: RequestUser,
    officerId: string,
    dto: UpdateOfficerEmploymentStatusDto,
    audit: AuditContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findOfficerOrNotFound(
      organisationId,
      officerId,
    );
    const previousStatus = existing.employmentStatus;
    const revokeSessions = this.shouldRevokeForEmploymentStatus(
      dto.employmentStatus,
    );
    const userStatus = this.mapEmploymentToAccountStatus(dto.employmentStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.officerProfile.update({
        where: { id: existing.id },
        data: {
          employmentStatus: dto.employmentStatus,
          deletedAt:
            dto.employmentStatus === OfficerEmploymentStatus.ARCHIVED
              ? new Date()
              : undefined,
        },
      });

      if (userStatus) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            status: userStatus,
            deletedAt:
              dto.employmentStatus === OfficerEmploymentStatus.ARCHIVED
                ? new Date()
                : undefined,
          },
        });
      }

      return tx.officerProfile.findFirstOrThrow({
        where: { id: existing.id },
        include: OFFICER_INCLUDE,
      });
    });

    if (revokeSessions) {
      await this.sessionService.revokeAllForUser(existing.userId);
    }

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'OfficerProfile',
      entityId: existing.id,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      metadata: {
        field: 'employmentStatus',
        previousStatus,
        newStatus: dto.employmentStatus,
        reason: dto.reason ?? null,
      },
    });

    return mapOfficerDetail(updated, { includeNotes: true });
  }

  async archive(
    actor: RequestUser,
    officerId: string,
    audit: AuditContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findOfficerOrNotFound(
      organisationId,
      officerId,
    );

    if (existing.deletedAt) {
      throw new AppException(
        'Officer is already archived',
        HttpStatus.CONFLICT,
        ErrorCode.OFFICER_NOT_FOUND,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.officerProfile.update({
        where: { id: existing.id },
        data: {
          employmentStatus: OfficerEmploymentStatus.ARCHIVED,
          deletedAt: now,
        },
      });

      await tx.user.update({
        where: { id: existing.userId },
        data: {
          status: 'ARCHIVED',
          deletedAt: now,
        },
      });

      await tx.supervisorOfficer.updateMany({
        where: {
          organisationId,
          officerId: existing.id,
          OR: [{ activeUntil: null }, { activeUntil: { gt: now } }],
        },
        data: { activeUntil: now },
      });
    });

    await this.sessionService.revokeAllForUser(existing.userId);

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.DELETE,
      entityType: 'OfficerProfile',
      entityId: existing.id,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  private async buildListWhere(
    actor: RequestUser,
    organisationId: string,
    query: ListOfficersQueryDto,
  ): Promise<Prisma.OfficerProfileWhereInput> {
    const where: Prisma.OfficerProfileWhereInput = {
      organisationId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
    };

    if (query.employmentStatus) {
      where.employmentStatus = query.employmentStatus;
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { officerNumber: { contains: term, mode: 'insensitive' } },
        { user: { employeeId: { contains: term, mode: 'insensitive' } } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
        { user: { displayName: { contains: term, mode: 'insensitive' } } },
        { user: { phone: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.supervisorId) {
      where.supervisorLinks = {
        some: {
          supervisorId: query.supervisorId,
          OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
        },
      };
    }

    if (actor.role === AppUserRole.SUPERVISOR) {
      const supervisorProfile = await this.prisma.supervisorProfile.findFirst({
        where: { organisationId, userId: actor.id, deletedAt: null },
        select: { id: true },
      });

      if (!supervisorProfile) {
        where.id = { in: [] };
      } else {
        where.supervisorLinks = {
          some: {
            supervisorId: supervisorProfile.id,
            OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
          },
        };
      }
    }

    return where;
  }

  private buildOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Prisma.OfficerProfileOrderByWithRelationInput {
    if (sortBy === 'hireDate' || sortBy === 'officerNumber') {
      return { [sortBy]: sortOrder };
    }

    return { createdAt: sortOrder };
  }

  private async findOfficerOrNotFound(
    organisationId: string,
    officerId: string,
  ) {
    const profile = await this.prisma.officerProfile.findFirst({
      where: { id: officerId, organisationId },
      include: OFFICER_INCLUDE,
    });

    if (!profile || profile.deletedAt) {
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }

    return profile;
  }

  private async findOfficerForAccess(
    actor: RequestUser,
    organisationId: string,
    officerId: string,
  ) {
    const profile = await this.prisma.officerProfile.findFirst({
      where: { id: officerId, organisationId },
      include: OFFICER_INCLUDE,
    });

    if (!profile || profile.deletedAt) {
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }

    assertSameOrganisation(organisationId, profile.organisationId);

    if (actor.role === AppUserRole.ADMINISTRATOR) {
      return profile;
    }

    if (actor.role === AppUserRole.SECURITY_OFFICER) {
      if (profile.userId === actor.id) {
        return profile;
      }
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }

    if (actor.role === AppUserRole.SUPERVISOR) {
      const assigned = await this.isOfficerAssignedToSupervisorUser(
        organisationId,
        actor.id,
        profile.id,
      );
      if (assigned) {
        return profile;
      }
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }

    throw new AppException(
      'Officer access forbidden',
      HttpStatus.FORBIDDEN,
      ErrorCode.OFFICER_ACCESS_FORBIDDEN,
    );
  }

  private async isOfficerAssignedToSupervisorUser(
    organisationId: string,
    supervisorUserId: string,
    officerId: string,
  ): Promise<boolean> {
    const supervisorProfile = await this.prisma.supervisorProfile.findFirst({
      where: { organisationId, userId: supervisorUserId, deletedAt: null },
      select: { id: true },
    });

    if (!supervisorProfile) {
      return false;
    }

    const link = await this.prisma.supervisorOfficer.findFirst({
      where: {
        organisationId,
        supervisorId: supervisorProfile.id,
        officerId,
        OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
      },
    });

    return Boolean(link);
  }

  private buildUserUpdateData(
    user?: UpdateOfficerDto['user'],
  ): Prisma.UserUpdateInput | null {
    if (!user) {
      return null;
    }

    const data: Prisma.UserUpdateInput = {};

    if (user.email !== undefined) {
      data.email = normalizeEmail(user.email);
    }
    if (user.phone !== undefined) {
      data.phone = normalizePhone(user.phone);
    }
    if (user.firstName !== undefined) {
      data.firstName = normalizePersonName(user.firstName);
    }
    if (user.middleName !== undefined) {
      data.middleName = trimOrUndefined(user.middleName) ?? null;
    }
    if (user.lastName !== undefined) {
      data.lastName = normalizePersonName(user.lastName);
    }
    if (user.displayName !== undefined) {
      data.displayName = trimOrUndefined(user.displayName) ?? null;
    }
    if (user.avatarUrl !== undefined) {
      data.avatarUrl = trimOrUndefined(user.avatarUrl) ?? null;
    }

    return Object.keys(data).length > 0 ? data : null;
  }

  private buildProfileUpdateData(
    profile?: UpdateOfficerDto['profile'],
    adminUpdate = false,
  ): Prisma.OfficerProfileUpdateInput | null {
    if (!profile) {
      return null;
    }

    const data: Prisma.OfficerProfileUpdateInput = {};

    if (adminUpdate && profile.officerNumber !== undefined) {
      data.officerNumber = normalizeCode(profile.officerNumber);
    }
    if (adminUpdate && profile.hireDate !== undefined) {
      data.hireDate = profile.hireDate ? new Date(profile.hireDate) : null;
    }
    if (adminUpdate && profile.nationalIdNumber !== undefined) {
      data.nationalIdNumber = trimOrUndefined(profile.nationalIdNumber) ?? null;
    }
    if (adminUpdate && profile.dateOfBirth !== undefined) {
      data.dateOfBirth = profile.dateOfBirth
        ? new Date(profile.dateOfBirth)
        : null;
    }
    if (profile.gender !== undefined) {
      data.gender = trimOrUndefined(profile.gender) ?? null;
    }
    if (profile.residentialAddress !== undefined) {
      data.residentialAddress =
        trimOrUndefined(profile.residentialAddress) ?? null;
    }
    if (profile.emergencyContactName !== undefined) {
      data.emergencyContactName =
        trimOrUndefined(profile.emergencyContactName) ?? null;
    }
    if (profile.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone =
        normalizePhone(profile.emergencyContactPhone) ?? null;
    }
    if (profile.emergencyContactRelationship !== undefined) {
      data.emergencyContactRelationship =
        trimOrUndefined(profile.emergencyContactRelationship) ?? null;
    }
    if (profile.rankOrTitle !== undefined) {
      data.rankOrTitle = trimOrUndefined(profile.rankOrTitle) ?? null;
    }
    if (profile.skills !== undefined) {
      data.skills = profile.skills as Prisma.InputJsonValue;
    }
    if (adminUpdate && profile.notes !== undefined) {
      data.notes = trimOrUndefined(profile.notes) ?? null;
    }

    return Object.keys(data).length > 0 ? data : null;
  }

  private shouldRevokeForEmploymentStatus(
    status: OfficerEmploymentStatus,
  ): boolean {
    return (
      status === OfficerEmploymentStatus.SUSPENDED ||
      status === OfficerEmploymentStatus.TERMINATED ||
      status === OfficerEmploymentStatus.ARCHIVED
    );
  }

  private mapEmploymentToAccountStatus(
    status: OfficerEmploymentStatus,
  ): 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'ARCHIVED' | null {
    switch (status) {
      case OfficerEmploymentStatus.ACTIVE:
      case OfficerEmploymentStatus.ON_LEAVE:
        return 'ACTIVE';
      case OfficerEmploymentStatus.SUSPENDED:
        return 'SUSPENDED';
      case OfficerEmploymentStatus.TERMINATED:
        return 'DISABLED';
      case OfficerEmploymentStatus.ARCHIVED:
        return 'ARCHIVED';
      default:
        return null;
    }
  }

  private handleCreateError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[]).join(',')
        : typeof error.meta?.target === 'string'
          ? error.meta.target
          : '';

      if (target.includes('email')) {
        throw new AppException(
          'Email already in use',
          HttpStatus.CONFLICT,
          ErrorCode.USER_EMAIL_CONFLICT,
        );
      }
      if (target.includes('employeeId')) {
        throw new AppException(
          'Employee ID already in use',
          HttpStatus.CONFLICT,
          ErrorCode.USER_EMPLOYEE_ID_CONFLICT,
        );
      }
      if (target.includes('phone')) {
        throw new AppException(
          'Phone already in use',
          HttpStatus.CONFLICT,
          ErrorCode.USER_PHONE_CONFLICT,
        );
      }
      if (target.includes('officerNumber')) {
        throw new AppException(
          'Officer number already in use',
          HttpStatus.CONFLICT,
          ErrorCode.OFFICER_NUMBER_CONFLICT,
        );
      }
      if (target.includes('userId')) {
        throw new AppException(
          'Officer profile already exists for user',
          HttpStatus.CONFLICT,
          ErrorCode.OFFICER_ALREADY_EXISTS,
        );
      }
    }

    throw error;
  }

  private handleUpdateError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[]).join(',')
        : typeof error.meta?.target === 'string'
          ? error.meta.target
          : '';

      if (target.includes('email')) {
        throw new AppException(
          'Email already in use',
          HttpStatus.CONFLICT,
          ErrorCode.USER_EMAIL_CONFLICT,
        );
      }
      if (target.includes('phone')) {
        throw new AppException(
          'Phone already in use',
          HttpStatus.CONFLICT,
          ErrorCode.USER_PHONE_CONFLICT,
        );
      }
      if (target.includes('officerNumber')) {
        throw new AppException(
          'Officer number already in use',
          HttpStatus.CONFLICT,
          ErrorCode.OFFICER_NUMBER_CONFLICT,
        );
      }
    }

    throw error;
  }
}
