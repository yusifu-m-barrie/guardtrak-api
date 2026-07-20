import type { Organisation } from '../../../../generated/prisma/client';

export function mapOrganisationSummary(organisation: Organisation) {
  return {
    id: organisation.id,
    code: organisation.code,
    name: organisation.name,
    legalName: organisation.legalName,
    registrationNumber: organisation.registrationNumber,
    email: organisation.email,
    phone: organisation.phone,
    address: organisation.address,
    countryCode: organisation.countryCode,
    timezone: organisation.timezone,
    logoUrl: organisation.logoUrl,
    status: organisation.status,
    createdAt: organisation.createdAt,
    updatedAt: organisation.updatedAt,
  };
}
