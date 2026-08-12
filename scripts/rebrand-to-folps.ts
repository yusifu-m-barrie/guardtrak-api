/**
 * One-shot live/dev rebrand: GUARDTRAK → FOLPS + admin name update.
 * Safe to re-run (idempotent).
 *
 * Usage (from guardtrak-api, with DATABASE_URL pointing at target DB):
 *   npm run rebrand:folps
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const org =
    (await prisma.organisation.findFirst({
      where: { code: 'GUARDTRAK', deletedAt: null },
    })) ??
    (await prisma.organisation.findFirst({
      where: { code: 'FOLPS', deletedAt: null },
    })) ??
    (await prisma.organisation.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: 'GuardTrak', mode: 'insensitive' } },
          { name: { contains: 'Faith Of Life', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.organisation.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }));

  if (!org) {
    throw new Error('No organisation found to rebrand');
  }

  const updatedOrg = await prisma.organisation.update({
    where: { id: org.id },
    data: {
      code: 'FOLPS',
      name: 'Faith Of Life Protective Services',
      legalName: 'Faith Of Life Protective Services Ltd',
      email:
        org.email && /guardtrak/i.test(org.email)
          ? 'ops@folps.local'
          : org.email,
    },
  });

  const admin = await prisma.user.findFirst({
    where: {
      organisationId: org.id,
      employeeId: 'ADM-001',
      deletedAt: null,
    },
  });

  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        firstName: 'Daniel',
        middleName: 'Salifu',
        lastName: 'Samura',
        displayName: 'Daniel Salifu Samura',
        email: /guardtrak/i.test(admin.email)
          ? 'admin@folps.local'
          : admin.email,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Rebrand complete:', {
    organisationId: updatedOrg.id,
    previousCode: org.code,
    code: updatedOrg.code,
    name: updatedOrg.name,
    adminUpdated: Boolean(admin),
    adminName: admin ? 'Daniel Salifu Samura' : null,
  });
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
