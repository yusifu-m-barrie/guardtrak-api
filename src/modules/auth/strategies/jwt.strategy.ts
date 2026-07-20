import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { ACCESS_TOKEN_TYPE } from '../auth.constants';
import { ErrorCode } from '../../../common/constants/error-codes';
import type { AccessTokenClaims } from '../services/token.service';
import type { RequestUser } from '../../../common/types/request-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
      issuer: configService.get<string>('jwt.issuer') ?? 'guardtrak-api',
      audience:
        configService.get<string>('jwt.audience') ?? 'guardtrak-clients',
    });
  }

  async validate(payload: AccessTokenClaims): Promise<RequestUser> {
    if (payload.type !== ACCESS_TOKEN_TYPE) {
      throw new UnauthorizedException({
        message: 'Invalid access token',
        code: ErrorCode.AUTH_TOKEN_INVALID,
      });
    }

    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException({
        message: 'Invalid access token',
        code: ErrorCode.AUTH_TOKEN_INVALID,
      });
    }

    return this.authService.validateAccessUser(payload.sub, payload.sessionId);
  }
}
