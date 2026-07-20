import type { Client } from '../../../../generated/prisma/client';

export interface ClientResponse {
  id: string;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  primaryContactName: string;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  billingAddress: string | null;
  operationalNotes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  siteCount?: number;
}

export function toClientResponse(
  client: Client,
  siteCount?: number,
): ClientResponse {
  const response: ClientResponse = {
    id: client.id,
    name: client.name,
    legalName: client.legalName,
    registrationNumber: client.registrationNumber,
    primaryContactName: client.primaryContactName,
    primaryContactEmail: client.primaryContactEmail,
    primaryContactPhone: client.primaryContactPhone,
    billingAddress: client.billingAddress,
    operationalNotes: client.operationalNotes,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };

  if (siteCount !== undefined) {
    response.siteCount = siteCount;
  }

  return response;
}
