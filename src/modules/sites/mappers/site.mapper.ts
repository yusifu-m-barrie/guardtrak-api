import type { Prisma, SecuritySite } from '../../../../generated/prisma/client';

type SiteWithClient = SecuritySite & {
  client?: { id: string; name: string; status: string };
};

export interface SiteClientSummary {
  id: string;
  name: string;
  status: string;
}

export interface SiteResponse {
  id: string;
  clientId: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  clockInRadiusMeters: number;
  clockOutRadiusMeters: number;
  checkpointDefaultRadiusMeters: number;
  minimumGpsAccuracyMeters: number;
  clockInOutsideGeofencePolicy: string;
  clockOutOutsideGeofencePolicy: string;
  requiresClockInSelfie: boolean;
  requiresClockOutSelfie: boolean;
  requiresPatrol: boolean;
  requiresFinalShiftNote: boolean;
  instructions: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  client?: SiteClientSummary;
}

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function toSiteResponse(site: SiteWithClient): SiteResponse {
  const response: SiteResponse = {
    id: site.id,
    clientId: site.clientId,
    name: site.name,
    code: site.code,
    address: site.address,
    latitude: decimalToNumber(site.latitude),
    longitude: decimalToNumber(site.longitude),
    clockInRadiusMeters: site.clockInRadiusMeters,
    clockOutRadiusMeters: site.clockOutRadiusMeters,
    checkpointDefaultRadiusMeters: site.checkpointDefaultRadiusMeters,
    minimumGpsAccuracyMeters: site.minimumGpsAccuracyMeters,
    clockInOutsideGeofencePolicy: site.clockInOutsideGeofencePolicy,
    clockOutOutsideGeofencePolicy: site.clockOutOutsideGeofencePolicy,
    requiresClockInSelfie: site.requiresClockInSelfie,
    requiresClockOutSelfie: site.requiresClockOutSelfie,
    requiresPatrol: site.requiresPatrol,
    requiresFinalShiftNote: site.requiresFinalShiftNote,
    instructions: site.instructions,
    emergencyContactName: site.emergencyContactName,
    emergencyContactPhone: site.emergencyContactPhone,
    status: site.status,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };

  if (site.client) {
    response.client = {
      id: site.client.id,
      name: site.client.name,
      status: site.client.status,
    };
  }

  return response;
}
