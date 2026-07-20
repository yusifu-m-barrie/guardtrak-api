import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PasswordResetPurpose,
  type User,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/constants/error-codes';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async issueOtp(user: User): Promise<{ otp: string; expiresAt: Date }> {
    const otp = this.tokenService.generateNumericOtp(6);
    const tokenHash = this.tokenService.hashOpaqueToken(otp);
    const minutes =
      this.configService.get<number>('auth.passwordResetOtpExpiresMinutes') ??
      10;
    const expiresAt = new Date(Date.now() + minutes * 60_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          purpose: PasswordResetPurpose.OTP,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          purpose: PasswordResetPurpose.OTP,
          tokenHash,
          expiresAt,
        },
      });
    });

    return { otp, expiresAt };
  }

  async verifyOtp(user: User, otp: string): Promise<string> {
    const tokenHash = this.tokenService.hashOpaqueToken(otp);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        purpose: PasswordResetPurpose.OTP,
        tokenHash,
      },
      orderBy: { createdAt: 'desc' },
    });

    const maxAttempts =
      this.configService.get<number>('auth.passwordResetMaxAttempts') ?? 5;

    if (!record || record.consumedAt) {
      throw new AppException(
        'Invalid or expired reset code',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_RESET_CODE_INVALID,
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        'Reset code has expired',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_RESET_CODE_EXPIRED,
      );
    }

    if (record.attempts >= maxAttempts) {
      throw new AppException(
        'Too many invalid reset code attempts',
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.AUTH_RESET_CODE_ATTEMPTS_EXCEEDED,
      );
    }

    // Increment attempts for wrong codes is handled by caller when hash mismatch.
    // Here hash already matched.
    const resetToken = this.tokenService.generateOpaqueToken(32);
    const resetHash = this.tokenService.hashOpaqueToken(resetToken);
    const resetMinutes =
      this.configService.get<number>('auth.resetTokenExpiresMinutes') ?? 15;
    const expiresAt = new Date(Date.now() + resetMinutes * 60_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          purpose: PasswordResetPurpose.RESET_TOKEN,
          tokenHash: resetHash,
          expiresAt,
        },
      });
    });

    return resetToken;
  }

  async registerInvalidOtpAttempt(userId: string): Promise<void> {
    const latest = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId,
        purpose: PasswordResetPurpose.OTP,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      return;
    }
    const maxAttempts =
      this.configService.get<number>('auth.passwordResetMaxAttempts') ?? 5;
    const attempts = latest.attempts + 1;
    await this.prisma.passwordResetToken.update({
      where: { id: latest.id },
      data: {
        attempts,
        consumedAt: attempts >= maxAttempts ? new Date() : latest.consumedAt,
      },
    });
    if (attempts >= maxAttempts) {
      throw new AppException(
        'Too many invalid reset code attempts',
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.AUTH_RESET_CODE_ATTEMPTS_EXCEEDED,
      );
    }
  }

  async resetWithToken(resetToken: string, newPassword: string): Promise<User> {
    this.passwordService.assertPolicy(newPassword);
    const tokenHash = this.tokenService.hashOpaqueToken(resetToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.purpose !== PasswordResetPurpose.RESET_TOKEN ||
      record.consumedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new AppException(
        'Invalid or expired reset token',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_RESET_TOKEN_INVALID,
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });

      return tx.user.update({
        where: { id: record.userId },
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
    return user;
  }

  allowDevOtpOutput(): boolean {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    if (nodeEnv === 'production' || nodeEnv === 'staging') {
      return false;
    }
    return this.configService.get<boolean>('auth.allowDevOtpOutput') === true;
  }
}
