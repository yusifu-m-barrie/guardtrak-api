import type {
  FaqArticle,
  SupportMessage,
  SupportRequest,
} from '../../../../generated/prisma/client';

export function toSupportRequestResponse(row: SupportRequest) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    requestNumber: row.requestNumber,
    userId: row.userId,
    subject: row.subject,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    createdAt: row.createdAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSupportMessageResponse(row: SupportMessage) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    supportRequestId: row.supportRequestId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toFaqResponse(row: FaqArticle) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    category: row.category,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sortOrder,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
