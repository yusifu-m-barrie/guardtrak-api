import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TokenService } from './token.service';
import type { RefreshSession } from '../../../../generated/prisma/client';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async createRefreshSession(input: {
    userId: string;
    deviceId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    familyId?: string;
    fingerprint?: string | null;
  }): Promise<{
    refreshToken: string;
    session: RefreshSession;
    expiresAt: Date;
  }> {
    const refreshToken = this.tokenService.generateOpaqueToken();
    const tokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const expiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.tokenService.expiresAtFromDuration(expiresIn);
    const familyId = input.familyId ?? randomUUID();

    const session = await this.prisma.refreshSession.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId ?? null,
        tokenHash,
        familyId,
        expiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        fingerprint: input.fingerprint ?? null,
        lastUsedAt: new Date(),
      },
    });

    return { refreshToken, session, expiresAt };
  }

  async findByRefreshToken(
    refreshToken: string,
  ): Promise<RefreshSession | null> {
    const tokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    return this.prisma.refreshSession.findUnique({ where: { tokenHash } });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllForDevice(deviceId: string): Promise<number> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async rotate(input: {
    current: RefreshSession;
    ipAddress?: string | null;
    userAgent?: string | null;
    fingerprint?: string | null;
  }): Promise<{
    refreshToken: string;
    session: RefreshSession;
    expiresAt: Date;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const refreshToken = this.tokenService.generateOpaqueToken();
      const tokenHash = this.tokenService.hashOpaqueToken(refreshToken);
      const expiresIn =
        this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d';
      const expiresAt = this.tokenService.expiresAtFromDuration(expiresIn);

      const session = await tx.refreshSession.create({
        data: {
          userId: input.current.userId,
          deviceId: input.current.deviceId,
          tokenHash,
          familyId: input.current.familyId,
          expiresAt,
          ipAddress: input.ipAddress ?? input.current.ipAddress,
          userAgent: input.userAgent ?? input.current.userAgent,
          fingerprint: input.fingerprint ?? input.current.fingerprint ?? null,
          lastUsedAt: new Date(),
        },
      });

      await tx.refreshSession.update({
        where: { id: input.current.id },
        data: {
          revokedAt: new Date(),
          replacedBySessionId: session.id,
        },
      });

      return { refreshToken, session, expiresAt };
    });
  }
}
