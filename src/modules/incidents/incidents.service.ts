import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccountStatus,
  AuditAction,
  IncidentNoteVisibility,
  IncidentPriority,
  IncidentStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
  UserRole as PrismaUserRole,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { UserRole } from '../../common/enums/user-role.enum';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashRequestPayload } from '../../common/idempotency/request-hash.util';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import { trimOrUndefined } from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { NotificationsService } from '../notifications/notifications.service';
import type { AssignIncidentDto } from './dto/assign-incident.dto';
import type { CloseIncidentDto } from './dto/close-incident.dto';
import type { CreateIncidentNoteDto } from './dto/create-incident-note.dto';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import type { EscalateIncidentDto } from './dto/escalate-incident.dto';
import type { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import type { ReopenIncidentDto } from './dto/reopen-incident.dto';
import type { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentAccessService } from './incident-access.service';
import { IncidentAuditService } from './incident-audit.service';
import { IncidentNumberService } from './incident-number.service';
import {
  assertIncidentTransition,
  canReopenIncident,
} from './incident-transitions.util';
import {
  INCIDENT_INCLUDE,
  toIncidentNoteResponse,
  toIncidentResponse,
  toIncidentStatusEventResponse,
} from './mappers/incident.mapper';
import { listIncidentCategories } from './incident-categories';

const INCIDENT_SORT = [
  'reportedAtServer',
  'occurredAtDevice',
  'createdAt',
  'priority',
] as const;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly accessService: IncidentAccessService,
    private readonly numberService: IncidentNumberService,
    private readonly incidentAudit: IncidentAuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  listCategories() {
    return listIncidentCategories();
  }

  async create(
    user: RequestUser,
    dto: CreateIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const ttl =
      this.configService.get<number>('incident.idempotencyTtlSeconds') ??
      86_400;
    const requestHash = hashRequestPayload({
      siteId: dto.siteId,
      category: dto.category,
      severity: dto.severity,
      title: dto.title,
      occurredAtDevice: dto.occurredAtDevice,
      localIncidentId: dto.localIncidentId ?? null,
    });
    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'incident.create',
      requestHash,
      ttlSeconds: ttl,
    });
    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }
    try {
      const response = await this.performCreate(user, organisationId, dto, ctx);
      await this.idempotencyService.complete(
        user.id,
        dto.idempotencyKey,
        201,
        response,
      );
      return response;
    } catch (error) {
      await this.idempotencyService.fail(
        user.id,
        dto.idempotencyKey,
        error instanceof Error ? error.message : 'incident create failed',
      );
      throw error;
    }
  }

  private async performCreate(
    user: RequestUser,
    organisationId: string,
    dto: CreateIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId && user.role === UserRole.SECURITY_OFFICER) {
      throw new AppException(
        'Officer profile is required to create an incident',
        HttpStatus.FORBIDDEN,
        ErrorCode.OFFICER_NOT_FOUND,
      );
    }
    const reportingOfficerId =
      officerId ??
      (
        await this.prisma.officerProfile.findFirst({
          where: { organisationId, userId: user.id, deletedAt: null },
          select: { id: true },
        })
      )?.id;
    if (!reportingOfficerId) {
      throw new AppException(
        'Officer profile is required to create an incident',
        HttpStatus.FORBIDDEN,
        ErrorCode.OFFICER_NOT_FOUND,
      );
    }

    const site = await this.prisma.securitySite.findFirst({
      where: { id: dto.siteId, organisationId, deletedAt: null },
    });
    if (!site) {
      tenantNotFound(ErrorCode.SITE_NOT_FOUND);
    }

    if (dto.localIncidentId) {
      const existing = await this.prisma.incident.findFirst({
        where: {
          organisationId,
          localIncidentId: dto.localIncidentId,
          deletedAt: null,
        },
      });
      if (existing) {
        const hydrated = await this.prisma.incident.findFirst({
          where: { id: existing.id },
          include: INCIDENT_INCLUDE,
        });
        return toIncidentResponse(hydrated ?? existing);
      }
    }

    const initialStatus =
      dto.initialStatus === IncidentStatus.DRAFT
        ? IncidentStatus.DRAFT
        : dto.initialStatus === IncidentStatus.NEW
          ? IncidentStatus.NEW
          : IncidentStatus.SUBMITTED;

    const incidentNumber = await this.numberService.nextNumber(organisationId);
    const now = new Date();
    const incident = await this.prisma.incident.create({
      data: {
        organisationId,
        incidentNumber,
        clientId: dto.clientId ?? site.clientId,
        siteId: site.id,
        shiftId: dto.shiftId ?? null,
        assignmentId: dto.assignmentId ?? null,
        patrolAssignmentId: dto.patrolAssignmentId ?? null,
        reportedByOfficerId: reportingOfficerId,
        reportedByUserId: user.id,
        category: dto.category,
        severity: dto.severity,
        priority: dto.priority ?? IncidentPriority.NORMAL,
        status: initialStatus,
        title: dto.title.trim(),
        description: dto.description.trim(),
        actionsTaken: trimOrUndefined(dto.actionsTaken) ?? null,
        occurredAtDevice: new Date(dto.occurredAtDevice),
        occurredAtServer: now,
        reportedAtServer: now,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        accuracyMeters: dto.accuracyMeters ?? null,
        weatherNotes: trimOrUndefined(dto.weatherNotes) ?? null,
        emergencyServicesContacted: dto.emergencyServicesContacted ?? false,
        emergencyServiceDetails:
          trimOrUndefined(dto.emergencyServiceDetails) ?? null,
        requiresImmediateNotification:
          dto.requiresImmediateNotification ?? false,
        localIncidentId: dto.localIncidentId ?? null,
        statusEvents: {
          create: {
            organisationId,
            previousStatus: null,
            newStatus: initialStatus,
            actorUserId: user.id,
            note: 'Incident created',
            occurredAt: now,
          },
        },
      },
    });

    await this.incidentAudit.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entityId: incident.id,
        metadata: { status: initialStatus, incidentNumber },
      },
      ctx,
    );

    if (initialStatus !== IncidentStatus.DRAFT) {
      await this.notifySupervisorsOnCreate(
        organisationId,
        incident.id,
        user.id,
      );
    }

    this.eventEmitter.emit('incident.created', {
      organisationId,
      incidentId: incident.id,
      actorUserId: user.id,
    });

    const hydrated = await this.prisma.incident.findFirst({
      where: { id: incident.id },
      include: INCIDENT_INCLUDE,
    });
    return toIncidentResponse(hydrated ?? incident);
  }

  private async notifySupervisorsOnCreate(
    organisationId: string,
    incidentId: string,
    actorUserId: string,
  ) {
    const supervisors = await this.prisma.user.findMany({
      where: {
        organisationId,
        role: { in: [PrismaUserRole.SUPERVISOR, PrismaUserRole.ADMINISTRATOR] },
        status: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
    await this.notificationsService.notifyUsers(
      organisationId,
      supervisors.map((s) => s.id),
      {
        type: NotificationType.INCIDENT_SUBMITTED,
        title: 'New incident reported',
        body: 'An officer submitted a new incident report.',
        priority: NotificationPriority.HIGH,
        data: { incidentId },
        actorUserId,
      },
    );
  }

  async findAll(user: RequestUser, query: ListIncidentsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sort =
      assertAllowedSortField(
        query.sort ?? 'reportedAtServer',
        INCIDENT_SORT,
        'reportedAtServer',
      ) ?? 'reportedAtServer';
    const scope = await this.accessService.listScopeWhere(user, organisationId);
    const where: Prisma.IncidentWhereInput = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.officerId ? { reportedByOfficerId: query.officerId } : {}),
      ...(query.supervisorId
        ? { assignedSupervisorId: query.supervisorId }
        : {}),
      ...(query.from || query.to
        ? {
            reportedAtServer: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                incidentNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        orderBy: { [sort]: 'desc' },
        skip,
        take: limit,
        include: INCIDENT_INCLUDE,
      }),
    ]);
    return {
      data: rows.map(toIncidentResponse),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async statistics(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const scope = await this.accessService.listScopeWhere(user, organisationId);
    const grouped = await this.prisma.incident.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    });
    const bySeverity = await this.prisma.incident.groupBy({
      by: ['severity'],
      where: scope,
      _count: { _all: true },
    });
    const byPriority = await this.prisma.incident.groupBy({
      by: ['priority'],
      where: scope,
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        grouped.map((g) => [g.status, g._count._all]),
      ),
      bySeverity: Object.fromEntries(
        bySeverity.map((g) => [g.severity, g._count._all]),
      ),
      byPriority: Object.fromEntries(
        byPriority.map((g) => [g.priority, g._count._all]),
      ),
      total: grouped.reduce((sum, g) => sum + g._count._all, 0),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.prisma.incident.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: INCIDENT_INCLUDE,
    });
    if (!incident) {
      tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
    }
    await this.accessService.assertCanReadIncident(
      user,
      organisationId,
      incident,
    );
    return toIncidentResponse(incident);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.requireIncident(organisationId, id);
    const isReporter = incident.reportedByUserId === user.id;
    if (isReporter && userHasPermission(user, 'incident:create:self')) {
      // officer can patch own open drafts/submitted
      const editableByReporter: IncidentStatus[] = [
        IncidentStatus.DRAFT,
        IncidentStatus.SUBMITTED,
        IncidentStatus.NEW,
      ];
      if (!editableByReporter.includes(incident.status)) {
        await this.accessService.assertCanManageIncident(
          user,
          organisationId,
          incident,
        );
      }
    } else {
      await this.accessService.assertCanManageIncident(
        user,
        organisationId,
        incident,
      );
    }
    await this.prisma.incident.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.actionsTaken !== undefined
          ? { actionsTaken: trimOrUndefined(dto.actionsTaken) ?? null }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.weatherNotes !== undefined
          ? { weatherNotes: trimOrUndefined(dto.weatherNotes) ?? null }
          : {}),
      },
    });
    await this.incidentAudit.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityId: id,
      },
      ctx,
    );
    this.eventEmitter.emit('incident.updated', {
      organisationId,
      incidentId: id,
      actorUserId: user.id,
    });
    return this.reloadIncidentResponse(organisationId, id);
  }

  async assign(
    user: RequestUser,
    id: string,
    dto: AssignIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.requireIncident(organisationId, id);
    await this.accessService.assertCanManageIncident(
      user,
      organisationId,
      incident,
    );
    const supervisor = await this.prisma.user.findFirst({
      where: {
        id: dto.supervisorUserId,
        organisationId,
        role: {
          in: [PrismaUserRole.SUPERVISOR, PrismaUserRole.ADMINISTRATOR],
        },
        deletedAt: null,
      },
    });
    if (!supervisor) {
      throw new AppException(
        'Supervisor user not found',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INCIDENT_ASSIGNMENT_INVALID,
      );
    }
    let nextStatus = incident.status;
    if (
      incident.status === IncidentStatus.SUBMITTED ||
      incident.status === IncidentStatus.NEW
    ) {
      nextStatus = IncidentStatus.ACKNOWLEDGED;
      assertIncidentTransition(incident.status, nextStatus);
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.incident.update({
        where: { id },
        data: {
          assignedSupervisorId: supervisor.id,
          status: nextStatus,
          acknowledgedAt:
            nextStatus === IncidentStatus.ACKNOWLEDGED
              ? (incident.acknowledgedAt ?? now)
              : incident.acknowledgedAt,
        },
      });
      if (nextStatus !== incident.status) {
        await tx.incidentStatusEvent.create({
          data: {
            organisationId,
            incidentId: id,
            previousStatus: incident.status,
            newStatus: nextStatus,
            actorUserId: user.id,
            note: dto.note ?? 'Assigned to supervisor',
            occurredAt: now,
          },
        });
      }
      return row;
    });
    await this.incidentAudit.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.ASSIGN,
        entityId: id,
        metadata: { supervisorUserId: supervisor.id },
      },
      ctx,
    );
    await this.notificationsService.createAndDeliver({
      organisationId,
      recipientUserId: supervisor.id,
      type: NotificationType.INCIDENT_UPDATED,
      title: 'Incident assigned to you',
      body: `Incident ${incident.incidentNumber} was assigned to you.`,
      priority: NotificationPriority.HIGH,
      data: { incidentId: id },
      actorUserId: user.id,
      requestId: ctx.requestId,
    });
    return this.reloadIncidentResponse(organisationId, id);
  }

  async close(
    user: RequestUser,
    id: string,
    dto: CloseIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    return this.transition(
      user,
      id,
      IncidentStatus.CLOSED,
      dto.note,
      ctx,
      {
        closedAt: new Date(),
        resolutionSummary: dto.resolutionSummary,
      },
      AuditAction.RESOLVE,
    );
  }

  async reopen(
    user: RequestUser,
    id: string,
    dto: ReopenIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.requireIncident(organisationId, id);
    await this.accessService.assertCanManageIncident(
      user,
      organisationId,
      incident,
    );
    if (!canReopenIncident(incident.status)) {
      throw new AppException(
        'Only closed or rejected incidents can be reopened',
        HttpStatus.CONFLICT,
        ErrorCode.INCIDENT_NOT_CLOSED,
      );
    }
    return this.transition(
      user,
      id,
      IncidentStatus.UNDER_REVIEW,
      dto.note,
      ctx,
      { closedAt: null },
      AuditAction.UPDATE,
    );
  }

  async escalate(
    user: RequestUser,
    id: string,
    dto: EscalateIncidentDto,
    ctx: ServiceRequestContext,
  ) {
    return this.transition(
      user,
      id,
      IncidentStatus.ESCALATED,
      dto.note,
      ctx,
      {
        escalationReason: dto.escalationReason,
        escalationTriggeredAt: new Date(),
      },
      AuditAction.ESCALATE,
    );
  }

  async addNote(
    user: RequestUser,
    id: string,
    dto: CreateIncidentNoteDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.requireIncident(organisationId, id);
    const isReporter = incident.reportedByUserId === user.id;
    if (!isReporter) {
      await this.accessService.assertCanManageIncident(
        user,
        organisationId,
        incident,
      );
    }
    await this.accessService.assertCanReadIncident(
      user,
      organisationId,
      incident,
    );
    const visibility =
      dto.visibility ??
      (user.role === UserRole.SECURITY_OFFICER
        ? IncidentNoteVisibility.OFFICER_VISIBLE
        : IncidentNoteVisibility.SUPERVISOR_ONLY);
    const note = await this.prisma.incidentNote.create({
      data: {
        organisationId,
        incidentId: id,
        authorUserId: user.id,
        visibility,
        body: dto.body.trim(),
      },
    });
    await this.incidentAudit.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entityId: id,
        metadata: { noteId: note.id, visibility },
      },
      ctx,
    );
    return toIncidentNoteResponse(note);
  }

  async timeline(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.requireIncident(organisationId, id);
    await this.accessService.assertCanReadIncident(
      user,
      organisationId,
      incident,
    );
    const userSelect = {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
    } as const;
    const [events, notes] = await this.prisma.$transaction([
      this.prisma.incidentStatusEvent.findMany({
        where: { incidentId: id, organisationId },
        orderBy: { occurredAt: 'asc' },
        include: { actorUser: { select: userSelect } },
      }),
      this.prisma.incidentNote.findMany({
        where: { incidentId: id, organisationId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { authorUser: { select: userSelect } },
      }),
    ]);
    const filteredNotes = notes.filter((n) => {
      if (n.visibility === IncidentNoteVisibility.OFFICER_VISIBLE) {
        return true;
      }
      if (n.visibility === IncidentNoteVisibility.ADMIN_ONLY) {
        return user.role === UserRole.ADMINISTRATOR;
      }
      return (
        user.role === UserRole.SUPERVISOR ||
        user.role === UserRole.ADMINISTRATOR ||
        n.authorUserId === user.id
      );
    });
    return {
      statusEvents: events.map(toIncidentStatusEventResponse),
      notes: filteredNotes.map(toIncidentNoteResponse),
    };
  }

  private async transition(
    user: RequestUser,
    id: string,
    to: IncidentStatus,
    note: string | undefined,
    ctx: ServiceRequestContext,
    extra: Prisma.IncidentUpdateInput,
    action: AuditAction,
  ) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.requireIncident(organisationId, id);
    await this.accessService.assertCanManageIncident(
      user,
      organisationId,
      incident,
    );
    assertIncidentTransition(incident.status, to);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.incident.update({
        where: { id },
        data: {
          status: to,
          ...extra,
        },
      });
      await tx.incidentStatusEvent.create({
        data: {
          organisationId,
          incidentId: id,
          previousStatus: incident.status,
          newStatus: to,
          actorUserId: user.id,
          note: note ?? null,
          occurredAt: now,
        },
      });
      return row;
    });
    await this.incidentAudit.record(
      {
        organisationId,
        actorUserId: user.id,
        action,
        entityId: id,
        metadata: { from: incident.status, to },
      },
      ctx,
    );
    if (to === IncidentStatus.ESCALATED) {
      const admins = await this.prisma.user.findMany({
        where: {
          organisationId,
          role: PrismaUserRole.ADMINISTRATOR,
          status: AccountStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true },
      });
      await this.notificationsService.notifyUsers(
        organisationId,
        admins.map((a) => a.id),
        {
          type: NotificationType.INCIDENT_ESCALATED,
          title: 'Incident escalated',
          body: `Incident ${incident.incidentNumber} was escalated.`,
          priority: NotificationPriority.CRITICAL,
          data: { incidentId: id },
          actorUserId: user.id,
          requestId: ctx.requestId,
        },
      );
    }
    return this.reloadIncidentResponse(organisationId, id);
  }

  private async requireIncident(organisationId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: INCIDENT_INCLUDE,
    });
    if (!incident) {
      tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
    }
    return incident;
  }

  private async reloadIncidentResponse(organisationId: string, id: string) {
    return toIncidentResponse(await this.requireIncident(organisationId, id));
  }
}
