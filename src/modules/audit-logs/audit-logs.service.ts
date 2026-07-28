import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import { requireOrganisationId } from '../../common/tenant/tenant.util';
import { normalisePagination } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { toAuditLogResponse } from './mappers/audit-log.mapper';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser, query: ListAuditLogsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);

    const and: Prisma.AuditLogWhereInput[] = [{ organisationId }];
    if (query.actorUserId) and.push({ actorUserId: query.actorUserId });
    if (query.action) and.push({ action: query.action });
    if (query.entityType) and.push({ entityType: query.entityType });
    if (query.entityId) and.push({ entityId: query.entityId });
    if (query.from || query.to) {
      and.push({
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      });
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      and.push({
        OR: [
          { entityType: { contains: term, mode: 'insensitive' } },
          {
            actorUser: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { employeeId: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    const where: Prisma.AuditLogWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actorUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              role: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items.map((row) => toAuditLogResponse(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }
}
