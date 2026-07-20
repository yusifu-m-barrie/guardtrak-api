import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user.type';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('user:create')
  @ApiOperation({ summary: 'Create an organisation user account' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateUserDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.usersService.create(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('user:read')
  @ApiOperation({
    summary: 'List organisation users with pagination and filters',
  })
  list(@CurrentUser() user: RequestUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.list(user, query);
  }

  @Get(':id')
  @Permissions('user:read')
  @ApiOperation({ summary: 'Get a single organisation user' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions('user:update')
  @ApiOperation({ summary: 'Update safe user profile fields' })
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.usersService.updateProfile(user, id, dto, this.ctx(req));
  }

  @Patch(':id/role')
  @Permissions('user:manage-role')
  @ApiOperation({ summary: 'Change a user role' })
  updateRole(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.usersService.updateRole(user, id, dto, this.ctx(req));
  }

  @Patch(':id/status')
  @Permissions('user:disable')
  @ApiOperation({ summary: 'Change a user account status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.usersService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @Permissions('user:unlock')
  @ApiOperation({ summary: 'Clear failed login attempts and account lockout' })
  unlock(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.usersService.unlock(user, id, this.ctx(req));
  }

  @Post(':id/force-password-reset')
  @HttpCode(HttpStatus.OK)
  @Permissions('user:reset-password')
  @ApiOperation({
    summary: 'Require password change on next login and revoke sessions',
  })
  forcePasswordReset(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.usersService.forcePasswordReset(user, id, this.ctx(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('user:archive')
  @ApiOperation({ summary: 'Soft-archive a user account' })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.usersService.archive(user, id, this.ctx(req));
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
