import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AccountStatus,
  AuditAction,
  OfficerEmploymentStatus,
  Prisma,
  UserRole,
  type User,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import type { RequestUser } from '../../common/types/request-user.type';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import {
  normalizeEmail,
  normalizeEmployeeId,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.types';
import { mapUserResponse } from './mappers/user.mapper';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';

export interface AuditRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const USER_SORT_FIELDS = [
  'createdAt',
  'firstName',
  'lastName',
  'email',
  'employeeId',
  'role',
  'status',
] as const;

const STATUS_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  [AccountStatus.INVITED]: [AccountStatus.ACTIVE],
  [AccountStatus.ACTIVE]: [AccountStatus.SUSPENDED, AccountStatus.DISABLED],
  [AccountStatus.SUSPENDED]: [AccountStatus.ACTIVE],
  [AccountStatus.DISABLED]: [AccountStatus.ACTIVE],
  [AccountStatus.ARCHIVED]: [],
};

const SESSION_REVOKE_STATUSES = new Set<AccountStatus>([
  AccountStatus.SUSPENDED,
  AccountStatus.DISABLED,
  AccountStatus.ARCHIVED,
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly authAuditService: AuthAuditService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
    private readonly localStorage: LocalStorageProvider,
  ) {}

  async create(
    actor: RequestUser,
    dto: CreateUserDto,
    ctx: AuditRequestContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const employeeId = normalizeEmployeeId(dto.employeeId);
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);
    const firstName = normalizePersonName(dto.firstName);
    const lastName = normalizePersonName(dto.lastName);
    const middleName = trimOrUndefined(dto.middleName);
    const displayName = trimOrUndefined(dto.displayName);

    this.assertAssignableRole(dto.role);

    await this.assertEmployeeIdAvailable(organisationId, employeeId);
    await this.assertEmailAvailable(email);
    if (phone) {
      await this.assertPhoneAvailable(organisationId, phone);
    }

    this.passwordService.assertPolicy(dto.temporaryPassword);
    const passwordHash = await this.passwordService.hash(dto.temporaryPassword);
    const mustChangePassword = dto.mustChangePassword ?? true;

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organisationId,
          employeeId,
          email,
          phone,
          passwordHash,
          firstName,
          middleName: middleName ?? null,
          lastName,
          displayName: displayName ?? null,
          role: dto.role,
          status: AccountStatus.ACTIVE,
          mustChangePassword,
          passwordChangedAt: null,
        },
      });
      await this.ensureRoleProfile(tx, created);
      return created;
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });

    return mapUserResponse(user);
  }

  async list(actor: RequestUser, query: ListUsersQueryDto) {
    const organisationId = requireOrganisationId(actor);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy =
      assertAllowedSortField(query.sortBy, USER_SORT_FIELDS, 'createdAt') ??
      'createdAt';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    const includeArchived = query.includeArchived === true;

    const where = this.buildListWhere(organisationId, query, includeArchived);

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return {
      data: users.map(mapUserResponse),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(actor: RequestUser, userId: string) {
    const organisationId = requireOrganisationId(actor);
    const user = await this.findTenantUser(organisationId, userId, true);
    return mapUserResponse(user);
  }

  async updateMe(
    actor: RequestUser,
    dto: UpdateUserDto,
    ctx: AuditRequestContext,
  ) {
    return this.updateProfile(actor, actor.id, dto, ctx);
  }

  async uploadMyAvatar(
    actor: RequestUser,
    file: Express.Multer.File | undefined,
    ctx: AuditRequestContext,
  ) {
    if (!file?.buffer?.length) {
      throw new AppException(
        'Avatar file is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        [{ field: 'file', message: 'Multipart file field is required' }],
      );
    }
    const mimeType = file.mimetype || 'application/octet-stream';
    if (!mimeType.startsWith('image/')) {
      throw new AppException(
        'Avatar must be an image',
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_CONTENT_TYPE_INVALID,
        [{ field: 'file', message: `Unexpected mimeType ${mimeType}` }],
      );
    }
    if (file.size > 5_242_880) {
      throw new AppException(
        'Avatar exceeds maximum allowed size',
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_FILE_TOO_LARGE,
      );
    }

    const organisationId = requireOrganisationId(actor);
    const ext = mimeType.includes('png')
      ? '.png'
      : mimeType.includes('webp')
        ? '.webp'
        : '.jpg';
    const storageKey = `${organisationId}/avatars/${actor.id}/${randomUUID()}${ext}`;
    this.localStorage.putObject(storageKey, file.buffer);
    const avatarUrl = this.storage.getPublicUrl(storageKey);
    const updated = await this.prisma.user.update({
      where: { id: actor.id },
      data: { avatarUrl },
    });
    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { selfUpdate: true, avatarUploaded: true, storageKey },
    });
    return mapUserResponse(updated);
  }

  async updateProfile(
    actor: RequestUser,
    userId: string,
    dto: UpdateUserDto,
    ctx: AuditRequestContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findTenantUser(organisationId, userId);

    const email =
      dto.email !== undefined ? normalizeEmail(dto.email) : undefined;
    const phone =
      dto.phone !== undefined ? normalizePhone(dto.phone) : undefined;
    const firstName =
      dto.firstName !== undefined
        ? normalizePersonName(dto.firstName)
        : undefined;
    const lastName =
      dto.lastName !== undefined
        ? normalizePersonName(dto.lastName)
        : undefined;
    const middleName =
      dto.middleName !== undefined
        ? (trimOrUndefined(dto.middleName) ?? null)
        : undefined;
    const displayName =
      dto.displayName !== undefined
        ? (trimOrUndefined(dto.displayName) ?? null)
        : undefined;

    if (email && email !== existing.email) {
      await this.assertEmailAvailable(email, existing.id);
    }
    if (phone && phone !== existing.phone) {
      await this.assertPhoneAvailable(organisationId, phone, existing.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(firstName !== undefined ? { firstName } : {}),
        ...(middleName !== undefined ? { middleName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        changedFields: Object.keys(dto).filter(
          (key) => dto[key as keyof UpdateUserDto] !== undefined,
        ),
      },
    });

    return mapUserResponse(updated);
  }

  async updateRole(
    actor: RequestUser,
    userId: string,
    dto: UpdateUserRoleDto,
    ctx: AuditRequestContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findTenantUser(organisationId, userId);

    if (actor.id === existing.id) {
      throw new AppException(
        'You cannot change your own role',
        HttpStatus.FORBIDDEN,
        ErrorCode.USER_ROLE_FORBIDDEN,
      );
    }

    this.assertAssignableRole(dto.role);

    if (
      existing.role === UserRole.ADMINISTRATOR &&
      dto.role !== UserRole.ADMINISTRATOR &&
      existing.status === AccountStatus.ACTIVE
    ) {
      await this.assertNotLastActiveAdmin(organisationId, existing.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: existing.id },
        data: { role: dto.role },
      });
      await this.ensureRoleProfile(tx, next);
      return next;
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        event: 'role_change',
        previousRole: existing.role,
        newRole: updated.role,
      },
    });

    return mapUserResponse(updated);
  }

  async updateStatus(
    actor: RequestUser,
    userId: string,
    dto: UpdateUserStatusDto,
    ctx: AuditRequestContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findTenantUser(organisationId, userId);

    this.assertStatusTransition(existing.status, dto.status);

    if (actor.id === existing.id) {
      throw new AppException(
        'You cannot change your own account status',
        HttpStatus.FORBIDDEN,
        ErrorCode.USER_SELF_STATUS_CHANGE_FORBIDDEN,
      );
    }

    if (
      existing.role === UserRole.ADMINISTRATOR &&
      existing.status === AccountStatus.ACTIVE &&
      (dto.status === AccountStatus.SUSPENDED ||
        dto.status === AccountStatus.DISABLED)
    ) {
      await this.assertNotLastActiveAdmin(organisationId, existing.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });

      if (SESSION_REVOKE_STATUSES.has(dto.status)) {
        await tx.refreshSession.updateMany({
          where: { userId: existing.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return user;
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        event: 'status_change',
        previousStatus: existing.status,
        newStatus: updated.status,
        reason: dto.reason ?? null,
      },
    });

    return mapUserResponse(updated);
  }

  async unlock(actor: RequestUser, userId: string, ctx: AuditRequestContext) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findTenantUser(organisationId, userId);

    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { event: 'unlock' },
    });

    return mapUserResponse(updated);
  }

  async forcePasswordReset(
    actor: RequestUser,
    userId: string,
    ctx: AuditRequestContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findTenantUser(organisationId, userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: { mustChangePassword: true },
      });

      await tx.refreshSession.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return user;
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { event: 'force_password_reset' },
    });

    return mapUserResponse(updated);
  }

  async archive(
    actor: RequestUser,
    userId: string,
    ctx: AuditRequestContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findTenantUser(organisationId, userId);

    if (existing.status === AccountStatus.ARCHIVED || existing.deletedAt) {
      throw new AppException(
        'User is already archived',
        HttpStatus.CONFLICT,
        ErrorCode.USER_ALREADY_ARCHIVED,
      );
    }

    if (actor.id === existing.id) {
      throw new AppException(
        'You cannot archive your own account',
        HttpStatus.FORBIDDEN,
        ErrorCode.USER_SELF_STATUS_CHANGE_FORBIDDEN,
      );
    }

    if (
      existing.role === UserRole.ADMINISTRATOR &&
      existing.status === AccountStatus.ACTIVE
    ) {
      await this.assertNotLastActiveAdmin(organisationId, existing.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          status: AccountStatus.ARCHIVED,
          deletedAt: new Date(),
        },
      });

      await tx.refreshSession.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        event: 'archive',
        previousStatus: existing.status,
      },
    });
  }

  private buildListWhere(
    organisationId: string,
    query: ListUsersQueryDto,
    includeArchived: boolean,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      organisationId,
      ...(includeArchived ? {} : { deletedAt: null }),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
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
        { employeeId: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async findTenantUser(
    organisationId: string,
    userId: string,
    includeArchived = false,
  ): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organisationId,
        ...(includeArchived ? {} : { deletedAt: null }),
      },
    });

    if (!user) {
      tenantNotFound(ErrorCode.USER_NOT_FOUND);
    }

    return user;
  }

  private assertAssignableRole(role: UserRole): void {
    if (role === UserRole.SUPER_ADMIN) {
      throw new AppException(
        'This role cannot be assigned',
        HttpStatus.FORBIDDEN,
        ErrorCode.USER_ROLE_FORBIDDEN,
      );
    }
  }

  /**
   * Assignments and officer APIs require OfficerProfile / SupervisorProfile rows.
   * Users created via /users historically skipped this — ensure profiles exist.
   */
  private async ensureRoleProfile(
    tx: Prisma.TransactionClient,
    user: Pick<User, 'id' | 'organisationId' | 'employeeId' | 'role'>,
  ): Promise<void> {
    const organisationId = user.organisationId;
    const employeeId = user.employeeId?.trim();
    if (!organisationId || !employeeId) {
      return;
    }

    if (user.role === UserRole.SECURITY_OFFICER) {
      const existing = await tx.officerProfile.findFirst({
        where: { userId: user.id },
        select: { id: true, deletedAt: true },
      });
      if (existing) {
        if (existing.deletedAt) {
          await tx.officerProfile.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              employmentStatus: OfficerEmploymentStatus.ACTIVE,
            },
          });
        }
        return;
      }

      const officerNumber = await this.allocateUniqueCode(
        tx,
        'officer',
        organisationId,
        employeeId,
      );
      await tx.officerProfile.create({
        data: {
          organisationId,
          userId: user.id,
          officerNumber,
          employmentStatus: OfficerEmploymentStatus.ACTIVE,
          rankOrTitle: 'Security Officer',
        },
      });
      return;
    }

    if (user.role === UserRole.SUPERVISOR) {
      const existing = await tx.supervisorProfile.findFirst({
        where: { userId: user.id },
        select: { id: true, deletedAt: true },
      });
      if (existing) {
        if (existing.deletedAt) {
          await tx.supervisorProfile.update({
            where: { id: existing.id },
            data: { deletedAt: null },
          });
        }
        return;
      }

      const supervisorNumber = await this.allocateUniqueCode(
        tx,
        'supervisor',
        organisationId,
        employeeId,
      );
      await tx.supervisorProfile.create({
        data: {
          organisationId,
          userId: user.id,
          supervisorNumber,
          title: 'Supervisor',
        },
      });
    }
  }

  private async allocateUniqueCode(
    tx: Prisma.TransactionClient,
    kind: 'officer' | 'supervisor',
    organisationId: string,
    employeeId: string,
  ): Promise<string> {
    const base = employeeId.trim().toUpperCase() || 'STAFF';
    const candidates = [
      base,
      kind === 'officer' ? `OFF-${base}` : `SUP-${base}`,
      `${kind === 'officer' ? 'OFF' : 'SUP'}-${base}-${Date.now().toString(36).toUpperCase()}`,
    ];

    for (const candidate of candidates) {
      const clash =
        kind === 'officer'
          ? await tx.officerProfile.findFirst({
              where: { organisationId, officerNumber: candidate },
              select: { id: true },
            })
          : await tx.supervisorProfile.findFirst({
              where: { organisationId, supervisorNumber: candidate },
              select: { id: true },
            });
      if (!clash) {
        return candidate;
      }
    }

    return `${kind === 'officer' ? 'OFF' : 'SUP'}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private assertStatusTransition(
    current: AccountStatus,
    next: AccountStatus,
  ): void {
    const allowed = STATUS_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new AppException(
        `Status transition from ${current} to ${next} is not allowed`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.BAD_REQUEST,
      );
    }
  }

  private async assertNotLastActiveAdmin(
    organisationId: string,
    excludeUserId: string,
  ): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: {
        organisationId,
        role: UserRole.ADMINISTRATOR,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
        id: { not: excludeUserId },
      },
    });

    if (remaining === 0) {
      throw new AppException(
        'Organisation must retain at least one active administrator',
        HttpStatus.CONFLICT,
        ErrorCode.USER_LAST_ADMIN_REQUIRED,
      );
    }
  }

  private async assertEmployeeIdAvailable(
    organisationId: string,
    employeeId: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        organisationId,
        employeeId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        'Employee ID is already in use within this organisation',
        HttpStatus.CONFLICT,
        ErrorCode.USER_EMPLOYEE_ID_CONFLICT,
      );
    }
  }

  private async assertEmailAvailable(
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        'Email is already in use',
        HttpStatus.CONFLICT,
        ErrorCode.USER_EMAIL_CONFLICT,
      );
    }
  }

  private async assertPhoneAvailable(
    organisationId: string,
    phone: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        organisationId,
        phone,
        deletedAt: null,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        'Phone number is already in use within this organisation',
        HttpStatus.CONFLICT,
        ErrorCode.USER_PHONE_CONFLICT,
      );
    }
  }
}
