import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user.type';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with organisation code and employee ID' })
  login(@Body() dto: LoginDto, @Req() req: Request & { requestId?: string }) {
    return this.authService.login(dto, this.ctx(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authService.refresh(dto.refreshToken, this.ctx(req));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start password reset (generic response)' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authService.forgotPassword(
      dto.organisationCode,
      dto.employeeId,
      this.ctx(req),
    );
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify password-reset OTP and receive reset token',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(
      dto.organisationCode,
      dto.employeeId,
      dto.otp,
    );
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a short-lived reset token' })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authService.resetPassword(
      dto.resetToken,
      dto.newPassword,
      dto.confirmPassword,
      this.ctx(req),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.authService.logout(user, this.ctx(req));
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all refresh sessions for the user' })
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.authService.logoutAll(user, this.ctx(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user profile' })
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password and revoke all sessions (re-login required)',
  })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.authService.changePassword(user, dto, this.ctx(req));
  }

  private ctx(req: Request & { requestId?: string }) {
    const requestIdHeader = req.headers[REQUEST_ID_HEADER];
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      requestId:
        req.requestId ??
        (typeof requestIdHeader === 'string' ? requestIdHeader : null),
    };
  }
}
