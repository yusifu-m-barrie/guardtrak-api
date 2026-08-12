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
import type { AssignSupervisorOfficersDto } from './dto/assign-supervisor-officers.dto';
import type { CreateSupervisorDto } from './dto/create-supervisor.dto';
import type { ListSupervisorOfficersQueryDto } from './dto/list-supervisor-officers-query.dto';
import type { ListSupervisorsQueryDto } from './dto/list-supervisors-query.dto';
import type { UpdateSupervisorDto } from './dto/update-supervisor.dto';
import {
  mapAssignedOfficer,
  mapSupervisorDetail,
  mapSupervisorMe,
  SUPERVISOR_USER_SELECT,
} from './mappers/supervisor.mapper';
import type { AuditContext } from '../officers/officers.service';

const SUPERVISOR_SORT_FIELDS = [
  'createdAt',
  'supervisorNumber',
  'updatedAt',
] as const;

const SUPERVISOR_INCLUDE = {
  user: { select: SUPERVISOR_USER_SELECT },
} satisfies Prisma.SupervisorProfileInclude;

const SUPERVISOR_ME_INCLUDE = (now = new Date()) =>
  ({
    user: { select: SUPERVISOR_USER_SELECT },
    officerLinks: {
      where: {
        OR: [{ activeUntil: null }, { activeUntil: { gt: now } }],
      },
      include: {
        officer: {
          include: {
            user: { select: SUPERVISOR_USER_SELECT },
          },
        },
      },
    },
  }) satisfies Prisma.SupervisorProfileInclude;

@Injectable()
export class SupervisorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly authAuditService: AuthAuditService,
  ) {}

  async create(
    actor: RequestUser,
    dto: CreateSupervisorDto,
    audit: AuditContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const employeeId = normalizeEmployeeId(dto.user.employeeId);
    const email = normalizeEmail(dto.user.email);
    const phone = normalizePhone(dto.user.phone);
    const supervisorNumber = normalizeCode(dto.profile.supervisorNumber);
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
            role: UserRole.SUPERVISOR,
            status: 'ACTIVE',
            mustChangePassword: true,
          },
          select: SUPERVISOR_USER_SELECT,
        });

        return tx.supervisorProfile.create({
          data: {
            organisationId,
            userId: user.id,
            supervisorNumber,
            title: trimOrUndefined(dto.profile.title) ?? null,
          },
          include: SUPERVISOR_INCLUDE,
        });
      });

      await this.authAuditService.record({
        organisationId,
        actorUserId: actor.id,
        action: AuditAction.CREATE,
        entityType: 'SupervisorProfile',
        entityId: result.id,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        metadata: {
          userId: result.userId,
          supervisorNumber: result.supervisorNumber,
        },
      });

      return mapSupervisorDetail(result);
    } catch (error) {
      this.handleCreateError(error);
    }
  }

  async list(actor: RequestUser, query: ListSupervisorsQueryDto) {
    const organisationId = requireOrganisationId(actor);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      SUPERVISOR_SORT_FIELDS,
      'createdAt',
    );
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.SupervisorProfileWhereInput = {
      organisationId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(actor.role === AppUserRole.SUPERVISOR
        ? { userId: actor.id }
        : {}),
    };

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { supervisorNumber: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { user: { employeeId: { contains: term, mode: 'insensitive' } } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
        { user: { displayName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.SupervisorProfileOrderByWithRelationInput =
      sortBy === 'supervisorNumber'
        ? { supervisorNumber: sortOrder }
        : { createdAt: sortOrder };

    const [items, total] = await Promise.all([
      this.prisma.supervisorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: SUPERVISOR_INCLUDE,
      }),
      this.prisma.supervisorProfile.count({ where }),
    ]);

    return {
      data: items.map(mapSupervisorDetail),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getMe(actor: RequestUser) {
    const organisationId = requireOrganisationId(actor);
    const profile = await this.prisma.supervisorProfile.findFirst({
      where: {
        organisationId,
        userId: actor.id,
        deletedAt: null,
      },
      include: SUPERVISOR_ME_INCLUDE(),
    });

    if (!profile) {
      tenantNotFound(ErrorCode.SUPERVISOR_NOT_FOUND);
    }

    return mapSupervisorMe(profile);
  }

  async getById(actor: RequestUser, supervisorId: string) {
    if (!userHasPermission(actor, 'supervisor:read')) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const organisationId = requireOrganisationId(actor);
    const profile = await this.findSupervisorForAccess(
      actor,
      organisationId,
      supervisorId,
    );

    return mapSupervisorDetail(profile);
  }

  async update(
    actor: RequestUser,
    supervisorId: string,
    dto: UpdateSupervisorDto,
    audit: AuditContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findSupervisorForAccess(
      actor,
      organisationId,
      supervisorId,
    );
    const profileData = this.buildProfileUpdateData(dto.profile, actor);
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
          await tx.supervisorProfile.update({
            where: { id: existing.id },
            data: profileData,
          });
        }

        return tx.supervisorProfile.findFirstOrThrow({
          where: { id: existing.id },
          include: SUPERVISOR_INCLUDE,
        });
      });

      await this.authAuditService.record({
        organisationId,
        actorUserId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'SupervisorProfile',
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

      return mapSupervisorDetail(updated);
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  async assignOfficers(
    actor: RequestUser,
    supervisorId: string,
    dto: AssignSupervisorOfficersDto,
    audit: AuditContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const supervisor = await this.findSupervisorOrNotFound(
      organisationId,
      supervisorId,
    );
    const activeFrom = new Date(dto.activeFrom);
    const activeUntil = dto.activeUntil ? new Date(dto.activeUntil) : null;

    if (activeUntil && activeUntil <= activeFrom) {
      throw new AppException(
        'activeUntil must be after activeFrom',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const uniqueOfficerIds = [...new Set(dto.officerIds)];

    const created = await this.prisma.$transaction(async (tx) => {
      const officers = await tx.officerProfile.findMany({
        where: {
          id: { in: uniqueOfficerIds },
          organisationId,
        },
        include: { user: { select: { id: true, status: true } } },
      });

      if (officers.length !== uniqueOfficerIds.length) {
        tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
      }

      for (const officer of officers) {
        this.assertOfficerAssignable(officer);
        await this.assertNoActiveRelation(
          tx,
          organisationId,
          supervisor.id,
          officer.id,
        );
      }

      const relations = [];
      for (const officerId of uniqueOfficerIds) {
        relations.push(
          await tx.supervisorOfficer.create({
            data: {
              organisationId,
              supervisorId: supervisor.id,
              officerId,
              activeFrom,
              activeUntil,
            },
          }),
        );
      }

      return relations;
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.ASSIGN,
      entityType: 'SupervisorOfficer',
      entityId: supervisor.id,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      metadata: {
        officerIds: uniqueOfficerIds,
        activeFrom: activeFrom.toISOString(),
        activeUntil: activeUntil?.toISOString() ?? null,
        relationCount: created.length,
      },
    });

    return {
      supervisorId: supervisor.id,
      assigned: created.map((relation) => ({
        relationId: relation.id,
        officerId: relation.officerId,
        activeFrom: relation.activeFrom,
        activeUntil: relation.activeUntil,
      })),
    };
  }

  async listOfficers(
    actor: RequestUser,
    supervisorId: string,
    query: ListSupervisorOfficersQueryDto,
  ) {
    const organisationId = requireOrganisationId(actor);
    await this.findSupervisorForAccess(actor, organisationId, supervisorId);

    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const activeOnly = query.activeOnly ?? true;
    const now = new Date();

    const where: Prisma.SupervisorOfficerWhereInput = {
      organisationId,
      supervisorId,
      ...(activeOnly
        ? {
            OR: [{ activeUntil: null }, { activeUntil: { gt: now } }],
          }
        : {}),
    };

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.officer = {
        OR: [
          { officerNumber: { contains: term, mode: 'insensitive' } },
          { user: { employeeId: { contains: term, mode: 'insensitive' } } },
          { user: { firstName: { contains: term, mode: 'insensitive' } } },
          { user: { lastName: { contains: term, mode: 'insensitive' } } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.supervisorOfficer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { activeFrom: 'desc' },
        include: {
          officer: {
            include: {
              user: { select: SUPERVISOR_USER_SELECT },
            },
          },
        },
      }),
      this.prisma.supervisorOfficer.count({ where }),
    ]);

    return {
      data: items.map(mapAssignedOfficer),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async unassignOfficer(
    actor: RequestUser,
    supervisorId: string,
    officerId: string,
    audit: AuditContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(actor);
    await this.findSupervisorOrNotFound(organisationId, supervisorId);

    const relation = await this.prisma.supervisorOfficer.findFirst({
      where: {
        organisationId,
        supervisorId,
        officerId,
        OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
      },
    });

    if (!relation) {
      throw new AppException(
        'Supervisor-officer relation not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.SUPERVISOR_OFFICER_RELATION_NOT_FOUND,
      );
    }

    const now = new Date();
    await this.prisma.supervisorOfficer.update({
      where: { id: relation.id },
      data: { activeUntil: now },
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.REASSIGN,
      entityType: 'SupervisorOfficer',
      entityId: relation.id,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      metadata: {
        supervisorId,
        officerId,
        activeUntil: now.toISOString(),
      },
    });
  }

  async archive(
    actor: RequestUser,
    supervisorId: string,
    audit: AuditContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findSupervisorOrNotFound(
      organisationId,
      supervisorId,
    );

    if (existing.deletedAt) {
      throw new AppException(
        'Supervisor is already archived',
        HttpStatus.CONFLICT,
        ErrorCode.SUPERVISOR_NOT_FOUND,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.supervisorProfile.update({
        where: { id: existing.id },
        data: { deletedAt: now },
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
          supervisorId: existing.id,
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
      entityType: 'SupervisorProfile',
      entityId: existing.id,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  private async findSupervisorOrNotFound(
    organisationId: string,
    supervisorId: string,
  ) {
    const profile = await this.prisma.supervisorProfile.findFirst({
      where: { id: supervisorId, organisationId },
      include: SUPERVISOR_INCLUDE,
    });

    if (!profile || profile.deletedAt) {
      tenantNotFound(ErrorCode.SUPERVISOR_NOT_FOUND);
    }

    return profile;
  }

  private async findSupervisorForAccess(
    actor: RequestUser,
    organisationId: string,
    supervisorId: string,
  ) {
    const profile = await this.findSupervisorOrNotFound(
      organisationId,
      supervisorId,
    );

    if (actor.role === AppUserRole.ADMINISTRATOR) {
      return profile;
    }

    if (actor.role === AppUserRole.SUPERVISOR && profile.userId === actor.id) {
      return profile;
    }

    tenantNotFound(ErrorCode.SUPERVISOR_NOT_FOUND);
  }

  private buildUserUpdateData(
    user?: UpdateSupervisorDto['user'],
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
    profile: UpdateSupervisorDto['profile'] | undefined,
    actor: RequestUser,
  ): Prisma.SupervisorProfileUpdateInput | null {
    if (!profile) {
      return null;
    }

    const data: Prisma.SupervisorProfileUpdateInput = {};
    const isAdmin = actor.role === AppUserRole.ADMINISTRATOR;

    if (isAdmin && profile.supervisorNumber !== undefined) {
      data.supervisorNumber = normalizeCode(profile.supervisorNumber);
    }
    if (profile.title !== undefined) {
      data.title = trimOrUndefined(profile.title) ?? null;
    }

    return Object.keys(data).length > 0 ? data : null;
  }

  private assertOfficerAssignable(officer: {
    deletedAt: Date | null;
    employmentStatus: OfficerEmploymentStatus;
  }): void {
    if (
      officer.deletedAt ||
      officer.employmentStatus === OfficerEmploymentStatus.ARCHIVED ||
      officer.employmentStatus === OfficerEmploymentStatus.TERMINATED
    ) {
      throw new AppException(
        'Officer cannot be assigned',
        HttpStatus.BAD_REQUEST,
        ErrorCode.OFFICER_ACCESS_FORBIDDEN,
      );
    }
  }

  private async assertNoActiveRelation(
    tx: Prisma.TransactionClient,
    organisationId: string,
    supervisorId: string,
    officerId: string,
  ): Promise<void> {
    const existing = await tx.supervisorOfficer.findFirst({
      where: {
        organisationId,
        officerId,
        OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
      },
      select: {
        id: true,
        supervisorId: true,
      },
    });

    if (!existing) {
      return;
    }

    if (existing.supervisorId === supervisorId) {
      throw new AppException(
        'This officer is already assigned to this supervisor',
        HttpStatus.CONFLICT,
        ErrorCode.SUPERVISOR_OFFICER_RELATION_EXISTS,
      );
    }

    throw new AppException(
      'This officer already has an active supervisor. Unassign them first before assigning a different supervisor.',
      HttpStatus.CONFLICT,
      ErrorCode.SUPERVISOR_OFFICER_RELATION_EXISTS,
    );
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
      if (target.includes('supervisorNumber')) {
        throw new AppException(
          'Supervisor number already in use',
          HttpStatus.CONFLICT,
          ErrorCode.SUPERVISOR_NUMBER_CONFLICT,
        );
      }
      if (target.includes('userId')) {
        throw new AppException(
          'Supervisor profile already exists for user',
          HttpStatus.CONFLICT,
          ErrorCode.SUPERVISOR_ALREADY_EXISTS,
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
      if (target.includes('supervisorNumber')) {
        throw new AppException(
          'Supervisor number already in use',
          HttpStatus.CONFLICT,
          ErrorCode.SUPERVISOR_NUMBER_CONFLICT,
        );
      }
    }

    throw error;
  }
}
