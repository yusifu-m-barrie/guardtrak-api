import type { Device } from '../../../../generated/prisma/client';

export interface DeviceResponse {
  id: string;
  userId: string;
  installationId: string;
  platform: string;
  deviceName: string | null;
  manufacturer: string | null;
  model: string | null;
  operatingSystem: string | null;
  operatingSystemVersion: string | null;
  appVersion: string | null;
  status: string;
  trustedAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toDeviceResponse(device: Device): DeviceResponse {
  return {
    id: device.id,
    userId: device.userId,
    installationId: device.installationId,
    platform: device.platform,
    deviceName: device.deviceName,
    manufacturer: device.manufacturer,
    model: device.model,
    operatingSystem: device.operatingSystem,
    operatingSystemVersion: device.operatingSystemVersion,
    appVersion: device.appVersion,
    status: device.status,
    trustedAt: device.trustedAt?.toISOString() ?? null,
    revokedAt: device.revokedAt?.toISOString() ?? null,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}
