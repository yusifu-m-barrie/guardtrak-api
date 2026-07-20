import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { DeviceAuthService } from './services/device-auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { AuthAuditService } from './services/auth-audit.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordService,
    TokenService,
    SessionService,
    DeviceAuthService,
    PasswordResetService,
    AuthAuditService,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    AuthAuditService,
    DeviceAuthService,
  ],
})
export class AuthModule {}
