import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  OfficerEmploymentStatus,
  PrismaClient,
  UserRole,
} from '../generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function allocateCode(
  kind: 'officer' | 'supervisor',
  organisationId: string,
  employeeId: string,
): Promise<string> {
  const base = String(employeeId || 'STAFF').trim().toUpperCase();
  const candidates = [
    base,
    kind === 'officer' ? `OFF-${base}` : `SUP-${base}`,
    `${kind === 'officer' ? 'OFF' : 'SUP'}-${base}-${Date.now().toString(36).toUpperCase()}`,
    `${kind === 'officer' ? 'OFF' : 'SUP'}-${randomUUID().slice(0, 8).toUpperCase()}`,
  ];

  for (const candidate of candidates) {
    const clash =
      kind === 'officer'
        ? await prisma.officerProfile.findFirst({
            where: { organisationId, officerNumber: candidate },
            select: { id: true },
          })
        : await prisma.supervisorProfile.findFirst({
            where: { organisationId, supervisorNumber: candidate },
            select: { id: true },
          });
    if (!clash) return candidate;
  }

  return candidates[candidates.length - 1]!;
}

async function main() {
  const officers = await prisma.user.findMany({
    where: {
      role: UserRole.SECURITY_OFFICER,
      deletedAt: null,
      officerProfile: null,
    },
    select: { id: true, organisationId: true, employeeId: true },
  });

  const supervisors = await prisma.user.findMany({
    where: {
      role: UserRole.SUPERVISOR,
      deletedAt: null,
      supervisorProfile: null,
    },
    select: { id: true, organisationId: true, employeeId: true },
  });

  let officerCreated = 0;
  for (const user of officers) {
    const officerNumber = await allocateCode(
      'officer',
      user.organisationId,
      user.employeeId,
    );
    await prisma.officerProfile.create({
      data: {
        organisationId: user.organisationId,
        userId: user.id,
        officerNumber,
        employmentStatus: OfficerEmploymentStatus.ACTIVE,
        rankOrTitle: 'Security Officer',
      },
    });
    officerCreated += 1;
    console.log(`officer profile -> ${user.employeeId} (${officerNumber})`);
  }

  let supervisorCreated = 0;
  for (const user of supervisors) {
    const supervisorNumber = await allocateCode(
      'supervisor',
      user.organisationId,
      user.employeeId,
    );
    await prisma.supervisorProfile.create({
      data: {
        organisationId: user.organisationId,
        userId: user.id,
        supervisorNumber,
        title: 'Supervisor',
      },
    });
    supervisorCreated += 1;
    console.log(`supervisor profile -> ${user.employeeId} (${supervisorNumber})`);
  }

  console.log(
    JSON.stringify({
      officerCreated,
      supervisorCreated,
      officerCandidates: officers.length,
      supervisorCandidates: supervisors.length,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
