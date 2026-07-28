import type { AuditAction, AuditLog, User, UserRole } from '../../../../generated/prisma/client';

type ActorUser = Pick<
  User,
  'id' | 'firstName' | 'lastName' | 'employeeId' | 'role' | 'email'
>;

export type AuditLogWithActor = AuditLog & {
  actorUser?: ActorUser | null;
};

export function toAuditLogResponse(row: AuditLogWithActor) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    actorUserId: row.actorUserId,
    action: row.action as AuditAction,
    entityType: row.entityType,
    entityId: row.entityId,
    requestId: row.requestId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    beforeData: row.beforeData,
    afterData: row.afterData,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    actor: row.actorUser
      ? {
          id: row.actorUser.id,
          firstName: row.actorUser.firstName,
          lastName: row.actorUser.lastName,
          employeeId: row.actorUser.employeeId,
          role: row.actorUser.role as UserRole,
          email: row.actorUser.email,
        }
      : null,
  };
}
