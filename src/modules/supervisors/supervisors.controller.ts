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
import { AssignSupervisorOfficersDto } from './dto/assign-supervisor-officers.dto';
import { CreateSupervisorDto } from './dto/create-supervisor.dto';
import { ListSupervisorOfficersQueryDto } from './dto/list-supervisor-officers-query.dto';
import { ListSupervisorsQueryDto } from './dto/list-supervisors-query.dto';
import { UpdateSupervisorDto } from './dto/update-supervisor.dto';
import { SupervisorsService } from './supervisors.service';

@ApiTags('supervisors')
@ApiBearerAuth()
@Controller('supervisors')
export class SupervisorsController {
  constructor(private readonly supervisorsService: SupervisorsService) {}

  @Post()
  @Permissions('supervisor:create')
  @ApiOperation({
    summary: 'Create supervisor user and profile transactionally',
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSupervisorDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supervisorsService.create(user, dto, this.auditContext(req));
  }

  @Get()
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'List organisation supervisors' })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListSupervisorsQueryDto,
  ) {
    return this.supervisorsService.list(user, query);
  }

  @Get('me')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'Read current supervisor profile' })
  me(@CurrentUser() user: RequestUser) {
    return this.supervisorsService.getMe(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read one supervisor with tenant-safe access checks',
  })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supervisorsService.getById(user, id);
  }

  @Patch(':id')
  @Permissions('supervisor:update')
  @ApiOperation({ summary: 'Update supervisor profile and linked user fields' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupervisorDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supervisorsService.update(
      user,
      id,
      dto,
      this.auditContext(req),
    );
  }

  @Post(':id/officers')
  @Permissions('supervisor:assign-officer')
  @ApiOperation({ summary: 'Assign officers to a supervisor' })
  assignOfficers(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSupervisorOfficersDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supervisorsService.assignOfficers(
      user,
      id,
      dto,
      this.auditContext(req),
    );
  }

  @Get(':id/officers')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'List officers assigned to a supervisor' })
  listOfficers(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSupervisorOfficersQueryDto,
  ) {
    return this.supervisorsService.listOfficers(user, id, query);
  }

  @Delete(':id/officers/:officerId')
  @Permissions('supervisor:assign-officer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Supervisor-officer relation ended' })
  @ApiOperation({ summary: 'End an active supervisor-officer assignment' })
  async unassignOfficer(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('officerId', ParseUUIDPipe) officerId: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.supervisorsService.unassignOfficer(
      user,
      id,
      officerId,
      this.auditContext(req),
    );
  }

  @Delete(':id')
  @Permissions('supervisor:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Supervisor archived' })
  @ApiOperation({
    summary: 'Soft archive supervisor and end active assignments',
  })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.supervisorsService.archive(user, id, this.auditContext(req));
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
