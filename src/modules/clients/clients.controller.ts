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
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientStatusDto } from './dto/update-client-status.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Permissions('client:create')
  @ApiOperation({ summary: 'Create a client' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateClientDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.clientsService.create(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('client:read')
  @ApiOperation({ summary: 'List organisation clients' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListClientsQueryDto,
  ) {
    return this.clientsService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('client:read')
  @ApiOperation({ summary: 'Get a client by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions('client:update')
  @ApiOperation({ summary: 'Update a client' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.clientsService.update(user, id, dto, this.ctx(req));
  }

  @Patch(':id/status')
  @Permissions('client:update')
  @ApiOperation({ summary: 'Update client status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.clientsService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('client:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-archive a client' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.clientsService.archive(user, id, this.ctx(req));
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
