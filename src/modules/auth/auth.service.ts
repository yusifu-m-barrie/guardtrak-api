import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountStatus,
  AuditAction,
  OrganisationStatus,
  type User,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { PLATFORM_ORGANISATION_CODE } from './auth.constants';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { DeviceAuthService } from './services/device-auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { AuthAuditService } from './services/auth-audit.service';
import { EmailService } from '../email/email.service';
import { buildAuthUserPayload } from './mappers/auth-user.mapper';
import type { LoginDto } from './dto/login.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import { getPermissionsForRole } from './permissions/role-permissions';
import type { UserRole } from '../../common/enums/user-role.enum';
import { buildSessionFingerprint } from './utils/session-fingerprint.util';

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly deviceAuthService: DeviceAuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly authAuditService: AuthAuditService,
    private readonly emailService: EmailService,
  ) {}

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.resolveLoginUser(
      dto.organisationCode,
      dto.employeeId,
    );

    if (!user) {
      throw new AppException(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    this.assertAccountCanAuthenticate(user);
    this.assertNotLocked(user);

    const passwordValid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordValid) {
      await this.registerFailedLogin(user, ctx);
      throw new AppException(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    const maxAgeDays =
      this.configService.get<number>('auth.passwordMaxAgeDays') ?? 0;
    if (maxAgeDays > 0) {
      const changedAt = user.passwordChangedAt ?? user.createdAt;
      const ageMs = Date.now() - changedAt.getTime();
      if (ageMs > maxAgeDays * 86_400_000) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mustChangePassword: true },
        });
        user.mustChangePassword = true;
        await this.authAuditService.record({
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.SECURITY_EVENT,
          entityType: 'User',
          entityId: user.id,
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: { reason: 'password_expired', maxAgeDays },
        });
      }
    }

    if (!user.organisationId && user.role !== 'SUPER_ADMIN') {
      throw new AppException(
        'Organisation context is required',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_ORGANISATION_REQUIRED,
      );
    }

    let deviceId: string | null = null;
    if (user.organisationId) {
      const device = await this.deviceAuthService.upsertForLogin({
        organisationId: user.organisationId,
        userId: user.id,
        installationId: dto.installationId,
        platform: dto.platform,
        deviceName: dto.deviceName,
        appVersion: dto.appVersion,
        manufacturer: dto.manufacturer,
        model: dto.model,
        operatingSystem: dto.operatingSystem,
        operatingSystemVersion: dto.operatingSystemVersion,
      });
      deviceId = device.id;

      if (device.status === 'PENDING') {
        await this.authAuditService.record({
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.SECURITY_EVENT,
          entityType: 'Device',
          entityId: device.id,
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: { reason: 'login_blocked_device_pending' },
        });
        throw new AppException(
          'This device is pending administrator approval and cannot sign in yet',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_PENDING,
          [{ field: 'deviceId', message: device.id, code: 'DEVICE_PENDING' }],
        );
      }
    }

    if (await this.passwordService.needsRehash(user.passwordHash)) {
      const rehashed = await this.passwordService.hash(dto.password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: rehashed },
      });
    }

    const {
      refreshToken,
      session,
      expiresAt: refreshTokenExpiresAt,
    } = await this.sessionService.createRefreshSession({
      userId: user.id,
      deviceId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      fingerprint: buildSessionFingerprint(ctx.userAgent, dto.platform),
    });

    const access = await this.tokenService.signAccessToken({
      sub: user.id,
      organisationId: user.organisationId,
      role: user.role as UserRole,
      sessionId: session.id,
      deviceId,
      type: 'access',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.authAuditService.record({
      organisationId: user.organisationId,
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { deviceId, sessionId: session.id },
    });

    const fullUser = await this.loadUserBundle(user.id);

    return {
      accessToken: access.token,
      refreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      tokenType: 'Bearer',
      ...buildAuthUserPayload(fullUser),
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    const current = await this.sessionService.findByRefreshToken(refreshToken);

    if (!current) {
      throw new AppException(
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_TOKEN_INVALID,
      );
    }

    if (current.revokedAt) {
      await this.sessionService.revokeFamily(current.familyId);
      await this.authAuditService.record({
        actorUserId: current.userId,
        action: AuditAction.SECURITY_EVENT,
        entityType: 'RefreshSession',
        entityId: current.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          reason: 'refresh_reuse_detected',
          familyId: current.familyId,
        },
      });
      throw new AppException(
        'Refresh token reuse detected. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_REFRESH_REUSED,
      );
    }

    if (current.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        'Refresh token has expired',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_TOKEN_EXPIRED,
      );
    }

    const devicePlatform = current.deviceId
      ? (
          await this.prisma.device.findUnique({
            where: { id: current.deviceId },
            select: { platform: true },
          })
        )?.platform
      : null;
    const fingerprint = buildSessionFingerprint(
      ctx.userAgent,
      devicePlatform ?? null,
    );
    const strictFingerprint =
      this.configService.get<boolean>('auth.strictFingerprint') === true;
    if (
      strictFingerprint &&
      current.fingerprint &&
      current.fingerprint !== fingerprint
    ) {
      await this.sessionService.revokeFamily(current.familyId);
      await this.authAuditService.record({
        actorUserId: current.userId,
        action: AuditAction.SECURITY_EVENT,
        entityType: 'RefreshSession',
        entityId: current.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: 'fingerprint_mismatch' },
      });
      throw new AppException(
        'Session fingerprint mismatch',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_FINGERPRINT_MISMATCH,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: current.userId },
    });
    if (!user) {
      throw new AppException(
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_TOKEN_INVALID,
      );
    }
    this.assertAccountCanAuthenticate(user);

    if (current.deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: current.deviceId },
        select: { status: true },
      });
      if (
        !device ||
        device.status === 'BLOCKED' ||
        device.status === 'REVOKED'
      ) {
        throw new AppException(
          'This device is not permitted to refresh the session',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_BLOCKED,
        );
      }
      if (device.status === 'PENDING') {
        throw new AppException(
          'This device is pending administrator approval',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_PENDING,
        );
      }
    }

    const rotated = await this.sessionService.rotate({
      current,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      fingerprint,
    });

    const access = await this.tokenService.signAccessToken({
      sub: user.id,
      organisationId: user.organisationId,
      role: user.role as UserRole,
      sessionId: rotated.session.id,
      deviceId: rotated.session.deviceId,
      type: 'access',
    });

    const fullUser = await this.loadUserBundle(user.id);

    return {
      accessToken: access.token,
      refreshToken: rotated.refreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: rotated.expiresAt.toISOString(),
      tokenType: 'Bearer',
      user: buildAuthUserPayload(fullUser).user,
    };
  }

  async logout(authUser: RequestUser, ctx: RequestContext): Promise<void> {
    await this.sessionService.revokeSession(authUser.sessionId);
    await this.authAuditService.record({
      organisationId: authUser.organisationId,
      actorUserId: authUser.id,
      action: AuditAction.LOGOUT,
      entityType: 'RefreshSession',
      entityId: authUser.sessionId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async logoutAll(authUser: RequestUser, ctx: RequestContext): Promise<void> {
    await this.sessionService.revokeAllForUser(authUser.id);
    await this.authAuditService.record({
      organisationId: authUser.organisationId,
      actorUserId: authUser.id,
      action: AuditAction.SESSION_REVOKE,
      entityType: 'User',
      entityId: authUser.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { scope: 'all_sessions' },
    });
  }

  async me(authUser: RequestUser) {
    const fullUser = await this.loadUserBundle(authUser.id);
    const activeSession = await this.prisma.refreshSession.findUnique({
      where: { id: authUser.sessionId },
      include: { device: true },
    });

    return {
      ...buildAuthUserPayload(fullUser),
      session: activeSession
        ? {
            id: activeSession.id,
            expiresAt: activeSession.expiresAt,
            device: activeSession.device
              ? {
                  id: activeSession.device.id,
                  installationId: activeSession.device.installationId,
                  platform: activeSession.device.platform,
                  deviceName: activeSession.device.deviceName,
                  status: activeSession.device.status,
                }
              : null,
          }
        : null,
    };
  }

  async changePassword(
    authUser: RequestUser,
    dto: ChangePasswordDto,
    ctx: RequestContext,
  ): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new AppException(
        'Password confirmation does not match',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_PASSWORD_POLICY_FAILED,
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
    });

    const valid = await this.passwordService.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!valid) {
      throw new AppException(
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_CURRENT_PASSWORD_INVALID,
      );
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new AppException(
        'New password must differ from the current password',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_PASSWORD_REUSE,
      );
    }

    this.passwordService.assertPolicy(dto.newPassword);

    const historyLimit =
      this.configService.get<number>('auth.passwordHistoryCount') ?? 5;
    const recentHistory = await this.prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: historyLimit,
      select: { passwordHash: true },
    });
    const hashesToCheck = [
      user.passwordHash,
      ...recentHistory.map((h) => h.passwordHash),
    ];
    for (const previousHash of hashesToCheck) {
      if (await this.passwordService.verify(previousHash, dto.newPassword)) {
        throw new AppException(
          'New password must not match a recently used password',
          HttpStatus.BAD_REQUEST,
          ErrorCode.AUTH_PASSWORD_REUSE,
        );
      }
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: user.passwordHash,
        },
      });
      const obsolete = await tx.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: historyLimit,
        select: { id: true },
      });
      if (obsolete.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: obsolete.map((row) => row.id) } },
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    await this.sessionService.revokeAllForUser(user.id);

    await this.authAuditService.record({
      organisationId: user.organisationId,
      actorUserId: user.id,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: 'User',
      entityId: user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        event: 'password_changed',
        strength: this.passwordService.scoreStrength(dto.newPassword).label,
      },
    });
  }

  async forgotPassword(
    organisationCode: string,
    employeeId: string,
    ctx: RequestContext,
  ) {
    const generic = {
      message:
        'If the account exists, password-reset instructions have been prepared.',
    };

    const user = await this.resolveLoginUser(organisationCode, employeeId);
    if (!user || user.status === AccountStatus.ARCHIVED) {
      return generic;
    }

    const { otp } = await this.passwordResetService.issueOtp(user);

    if (this.configService.get<boolean>('email.enabled') === true) {
      void this.emailService
        .sendPasswordReset({ to: user.email, otp, locale: 'en' })
        .catch(() => undefined);
    }

    await this.authAuditService.record({
      organisationId: user.organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PasswordResetToken',
      entityId: user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { event: 'password_reset_requested' },
    });

    if (this.passwordResetService.allowDevOtpOutput()) {
      return { ...generic, devOtp: otp };
    }

    return generic;
  }

  async verifyOtp(organisationCode: string, employeeId: string, otp: string) {
    const user = await this.resolveLoginUser(organisationCode, employeeId);
    if (!user) {
      throw new AppException(
        'Invalid or expired reset code',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_RESET_CODE_INVALID,
      );
    }

    try {
      const resetToken = await this.passwordResetService.verifyOtp(user, otp);
      return { valid: true, resetToken };
    } catch (error: unknown) {
      if (error instanceof AppException && error.getStatus() === 429) {
        throw error;
      }
      await this.passwordResetService.registerInvalidOtpAttempt(user.id);
      throw new AppException(
        'Invalid or expired reset code',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_RESET_CODE_INVALID,
      );
    }
  }

  async resetPassword(
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
    ctx: RequestContext,
  ) {
    if (newPassword !== confirmPassword) {
      throw new AppException(
        'Password confirmation does not match',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_PASSWORD_POLICY_FAILED,
      );
    }

    const user = await this.passwordResetService.resetWithToken(
      resetToken,
      newPassword,
    );

    await this.authAuditService.record({
      organisationId: user.organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { event: 'password_reset_completed' },
    });

    return { message: 'Password has been reset successfully. Please sign in.' };
  }

  async validateAccessUser(
    userId: string,
    sessionId: string,
  ): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppException(
        'Invalid access token',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_TOKEN_INVALID,
      );
    }
    this.assertAccountCanAuthenticate(user);

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.revokedAt || session.userId !== user.id) {
      throw new AppException(
        'Session has been revoked',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_SESSION_REVOKED,
      );
    }

    if (session.deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: session.deviceId },
        select: { status: true },
      });
      if (
        !device ||
        device.status === 'BLOCKED' ||
        device.status === 'REVOKED'
      ) {
        throw new AppException(
          'This device is not permitted',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_BLOCKED,
        );
      }
      if (device.status === 'PENDING') {
        throw new AppException(
          'This device is pending administrator approval',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_PENDING,
        );
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      accountStatus: user.status as never,
      organisationId: user.organisationId,
      employeeId: user.employeeId,
      sessionId: session.id,
      deviceId: session.deviceId,
      permissions: getPermissionsForRole(user.role as UserRole),
    };
  }

  private async resolveLoginUser(
    organisationCode: string,
    employeeId: string,
  ): Promise<User | null> {
    const code = organisationCode.trim().toUpperCase();
    const emp = employeeId.trim();

    if (code === PLATFORM_ORGANISATION_CODE) {
      return this.prisma.user.findFirst({
        where: {
          organisationId: null,
          employeeId: emp,
          deletedAt: null,
        },
      });
    }

    const organisation = await this.prisma.organisation.findFirst({
      where: {
        code,
        deletedAt: null,
        status: OrganisationStatus.ACTIVE,
      },
    });

    if (!organisation) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        organisationId: organisation.id,
        employeeId: emp,
        deletedAt: null,
      },
    });
  }

  private assertAccountCanAuthenticate(user: User): void {
    if (
      user.status === AccountStatus.SUSPENDED ||
      user.status === AccountStatus.DISABLED ||
      user.status === AccountStatus.ARCHIVED
    ) {
      throw new AppException(
        'Account is not permitted to sign in',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_ACCOUNT_INACTIVE,
      );
    }

    // INVITED users may sign in but mustChangePassword should be enforced by clients.
  }

  private assertNotLocked(user: User): void {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppException(
        'Account is temporarily locked due to failed sign-in attempts',
        HttpStatus.LOCKED,
        ErrorCode.AUTH_ACCOUNT_LOCKED,
      );
    }
  }

  private async registerFailedLogin(
    user: User,
    ctx: RequestContext,
  ): Promise<void> {
    const maxAttempts =
      this.configService.get<number>('auth.maxFailedAttempts') ?? 5;
    const lockoutMinutes =
      this.configService.get<number>('auth.lockoutMinutes') ?? 15;

    const nextAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      nextAttempts >= maxAttempts
        ? new Date(Date.now() + lockoutMinutes * 60_000)
        : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedUntil,
      },
    });

    if (lockedUntil) {
      await this.authAuditService.record({
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: user.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { event: 'account_locked', attempts: nextAttempts },
      });
    }
  }

  private loadUserBundle(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        organisation: true,
        officerProfile: true,
        supervisorProfile: true,
      },
    });
  }
}
