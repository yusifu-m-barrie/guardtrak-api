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
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { CreateOfficerDto } from './dto/create-officer.dto';
import { ListOfficersQueryDto } from './dto/list-officers-query.dto';
import { UpdateOfficerDto } from './dto/update-officer.dto';
import { UpdateOfficerEmploymentStatusDto } from './dto/update-officer-employment-status.dto';
import { UpdateOfficerSelfDto } from './dto/update-officer-self.dto';
import { OfficersService } from './officers.service';

@ApiTags('officers')
@ApiBearerAuth()
@Controller('officers')
export class OfficersController {
  constructor(private readonly officersService: OfficersService) {}

  @Post()
  @Permissions('officer:create')
  @ApiOperation({ summary: 'Create officer user and profile transactionally' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateOfficerDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.officersService.create(user, dto, this.auditContext(req));
  }

  @Get()
  @Permissions('officer:read')
  @ApiOperation({
    summary:
      'List organisation officers (supervisors see assigned officers only)',
  })
  list(@CurrentUser() user: RequestUser, @Query() query: ListOfficersQueryDto) {
    return this.officersService.list(user, query);
  }

  @Get('me')
  @Permissions('officer:read:self')
  @ApiOperation({ summary: 'Read current officer profile' })
  me(@CurrentUser() user: RequestUser) {
    return this.officersService.getMe(user);
  }

  @Patch('me')
  @Permissions('profile:update:self')
  @ApiOperation({
    summary: 'Update current officer contact details and emergency contacts',
  })
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOfficerSelfDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.officersService.updateMe(user, dto, this.auditContext(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one officer with tenant-safe access checks' })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.officersService.getById(user, id);
  }

  @Patch(':id')
  @Permissions('officer:update')
  @ApiOperation({ summary: 'Update officer profile and linked user fields' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfficerDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.officersService.update(user, id, dto, this.auditContext(req));
  }

  @Patch(':id/employment-status')
  @Permissions('officer:update')
  @ApiOperation({ summary: 'Update officer employment status (admin)' })
  updateEmploymentStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfficerEmploymentStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.officersService.updateEmploymentStatus(
      user,
      id,
      dto,
      this.auditContext(req),
    );
  }

  @Delete(':id')
  @Permissions('officer:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Officer archived' })
  @ApiOperation({ summary: 'Soft archive officer and linked user' })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.officersService.archive(user, id, this.auditContext(req));
  }

  private auditContext(req: Request & { requestId?: string }) {
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
