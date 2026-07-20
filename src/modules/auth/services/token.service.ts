import { createHash, randomBytes, randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TYPE } from '../auth.constants';
import type { UserRole } from '../../../common/enums/user-role.enum';

export interface AccessTokenClaims {
  sub: string;
  organisationId: string | null;
  role: UserRole;
  sessionId: string;
  deviceId: string | null;
  type: typeof ACCESS_TOKEN_TYPE;
}

export interface IssuedAccessToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateOpaqueToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }

  generateNumericOtp(digits = 6): string {
    const max = 10 ** digits;
    const value = randomInt(0, max);
    return value.toString().padStart(digits, '0');
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    const expiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const issuer =
      this.configService.get<string>('jwt.issuer') ?? 'guardtrak-api';
    const audience =
      this.configService.get<string>('jwt.audience') ?? 'guardtrak-clients';

    const token = await this.jwtService.signAsync(
      { ...claims, type: ACCESS_TOKEN_TYPE },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: expiresIn as `${number}m` | `${number}d` | `${number}s`,
        issuer,
        audience,
      },
    );

    return {
      token,
      expiresAt: this.expiresAtFromDuration(expiresIn),
    };
  }

  expiresAtFromDuration(duration: string): Date {
    const match = /^(\d+)([smhd])$/i.exec(duration.trim());
    if (!match) {
      return new Date(Date.now() + 15 * 60 * 1000);
    }
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + amount * (multipliers[unit] ?? 60_000));
  }
}
