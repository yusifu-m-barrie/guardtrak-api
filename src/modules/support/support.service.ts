import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditAction,
  NotificationPriority,
  NotificationType,
  Prisma,
  SupportRequestCategory,
  SupportRequestPriority,
  SupportRequestStatus,
  UserRole,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { normalisePagination } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateSupportMessageDto } from './dto/create-support-message.dto';
import type { CreateSupportRequestDto } from './dto/create-support-request.dto';
import type { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import type { UpsertFaqDto } from './dto/upsert-faq.dto';
import {
  toFaqResponse,
  toSupportMessageResponse,
  toSupportRequestResponse,
} from './mappers/support.mapper';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listFaq(user: RequestUser | null) {
    const organisationId = user?.organisationId ?? null;
    const rows = await this.prisma.faqArticle.findMany({
      where: {
        deletedAt: null,
        published: true,
        OR: [
          { organisationId: null },
          ...(organisationId ? [{ organisationId }] : []),
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toFaqResponse);
  }

  async createFaq(
    user: RequestUser,
    dto: UpsertFaqDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const row = await this.prisma.faqArticle.create({
      data: {
        organisationId,
        category: dto.category,
        question: dto.question,
        answer: dto.answer,
        sortOrder: dto.sortOrder ?? 0,
        published: dto.published ?? true,
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'FaqArticle',
      entityId: row.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return toFaqResponse(row);
  }

  async updateFaq(
    user: RequestUser,
    id: string,
    dto: UpsertFaqDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.prisma.faqArticle.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ organisationId }, { organisationId: null }],
      },
    });
    if (!existing || existing.organisationId === null) {
      // only org-scoped FAQ editable by tenant admin; global seed is read-only
      if (!existing) {
        tenantNotFound(ErrorCode.FAQ_NOT_FOUND);
      }
      throw new AppException(
        'Global FAQ articles cannot be edited by tenant admins',
        HttpStatus.FORBIDDEN,
        ErrorCode.FAQ_ACCESS_FORBIDDEN,
      );
    }
    const row = await this.prisma.faqArticle.update({
      where: { id },
      data: {
        category: dto.category,
        question: dto.question,
        answer: dto.answer,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        published: dto.published ?? existing.published,
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'FaqArticle',
      entityId: id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return toFaqResponse(row);
  }

  async deleteFaq(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.prisma.faqArticle.findFirst({
      where: { id, organisationId, deletedAt: null },
    });
    if (!existing) {
      tenantNotFound(ErrorCode.FAQ_NOT_FOUND);
    }
    await this.prisma.faqArticle.update({
      where: { id },
      data: { deletedAt: new Date(), published: false },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'FaqArticle',
      entityId: id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { id, deleted: true };
  }

  async createRequest(
    user: RequestUser,
    dto: CreateSupportRequestDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const requestNumber = await this.nextRequestNumber(organisationId);
    const row = await this.prisma.supportRequest.create({
      data: {
        organisationId,
        requestNumber,
        userId: user.id,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        category: dto.category ?? SupportRequestCategory.GENERAL,
        priority: dto.priority ?? SupportRequestPriority.NORMAL,
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'SupportRequest',
      entityId: row.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    const admins = await this.prisma.user.findMany({
      where: {
        organisationId,
        role: UserRole.ADMINISTRATOR,
        deletedAt: null,
      },
      select: { id: true },
    });
    await this.notificationsService.notifyUsers(
      organisationId,
      admins.map((a) => a.id),
      {
        type: NotificationType.SUPPORT_UPDATE,
        title: 'New support request',
        body: row.subject,
        priority: NotificationPriority.NORMAL,
        data: { supportRequestId: row.id },
        actorUserId: user.id,
        requestId: ctx.requestId,
      },
    );
    return toSupportRequestResponse(row);
  }

  async listRequests(user: RequestUser, page = 1, limit = 20) {
    const organisationId = requireOrganisationId(user);
    const { skip } = normalisePagination(page, limit);
    const where: Prisma.SupportRequestWhereInput = {
      organisationId,
      ...(userHasPermission(user, 'support:read') ||
      userHasPermission(user, 'support:manage')
        ? {}
        : { userId: user.id }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supportRequest.count({ where }),
      this.prisma.supportRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: rows.map(toSupportRequestResponse),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getRequest(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const row = await this.prisma.supportRequest.findFirst({
      where: { id, organisationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) {
      tenantNotFound(ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }
    if (
      row.userId !== user.id &&
      !userHasPermission(user, 'support:read') &&
      !userHasPermission(user, 'support:manage')
    ) {
      tenantNotFound(ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }
    return {
      ...toSupportRequestResponse(row),
      messages: row.messages.map(toSupportMessageResponse),
    };
  }

  async addMessage(
    user: RequestUser,
    id: string,
    dto: CreateSupportMessageDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const request = await this.prisma.supportRequest.findFirst({
      where: { id, organisationId },
    });
    if (!request) {
      tenantNotFound(ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }
    const canManage =
      userHasPermission(user, 'support:update') ||
      userHasPermission(user, 'support:manage');
    if (request.userId !== user.id && !canManage) {
      tenantNotFound(ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }
    const message = await this.prisma.supportMessage.create({
      data: {
        organisationId,
        supportRequestId: id,
        authorUserId: user.id,
        body: dto.body.trim(),
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'SupportMessage',
      entityId: message.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { supportRequestId: id },
    });
    return toSupportMessageResponse(message);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateSupportStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (
      !userHasPermission(user, 'support:update') &&
      !userHasPermission(user, 'support:manage')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const request = await this.prisma.supportRequest.findFirst({
      where: { id, organisationId },
    });
    if (!request) {
      tenantNotFound(ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }
    const now = new Date();
    const updated = await this.prisma.supportRequest.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === SupportRequestStatus.ACKNOWLEDGED
          ? { acknowledgedAt: request.acknowledgedAt ?? now }
          : {}),
        ...(dto.status === SupportRequestStatus.RESOLVED
          ? { resolvedAt: request.resolvedAt ?? now }
          : {}),
        ...(dto.status === SupportRequestStatus.CLOSED
          ? { closedAt: request.closedAt ?? now }
          : {}),
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'SupportRequest',
      entityId: id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { status: dto.status, note: dto.note ?? null },
    });
    await this.notificationsService.createAndDeliver({
      organisationId,
      recipientUserId: request.userId,
      type: NotificationType.SUPPORT_UPDATE,
      title: 'Support request updated',
      body: `Status changed to ${dto.status}`,
      priority: NotificationPriority.NORMAL,
      data: { supportRequestId: id },
      actorUserId: user.id,
      requestId: ctx.requestId,
    });
    return toSupportRequestResponse(updated);
  }

  private async nextRequestNumber(organisationId: string): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SUP-${day}-`;
    const latest = await this.prisma.supportRequest.findFirst({
      where: { organisationId, requestNumber: { startsWith: prefix } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true },
    });
    let seq = 1;
    if (latest?.requestNumber) {
      const parsed = Number.parseInt(
        latest.requestNumber.slice(prefix.length),
        10,
      );
      if (!Number.isNaN(parsed)) {
        seq = parsed + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
