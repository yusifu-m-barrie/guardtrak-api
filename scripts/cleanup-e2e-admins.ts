import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AccountStatus, PrismaClient, UserRole } from '../generated/prisma/client';

const SEED_USER_IDS = new Set([
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
]);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const leftover = await prisma.user.findMany({
    where: {
      organisationId: '11111111-1111-4111-8111-111111111111',
      role: UserRole.ADMINISTRATOR,
      status: AccountStatus.ACTIVE,
      deletedAt: null,
      NOT: { id: { in: [...SEED_USER_IDS] } },
    },
    select: { id: true, employeeId: true },
  });

  if (leftover.length) {
    await prisma.user.updateMany({
      where: { id: { in: leftover.map((u) => u.id) } },
      data: { status: AccountStatus.DISABLED },
    });
    console.log(
      'Disabled leftover e2e admins:',
      leftover.map((u) => u.employeeId),
    );
  } else {
    console.log('No leftover active e2e admins');
  }

  await prisma.user.updateMany({
    where: { id: { in: [...SEED_USER_IDS] } },
    data: {
      status: AccountStatus.ACTIVE,
      lockedUntil: null,
      failedLoginAttempts: 0,
    },
  });
  console.log('Seed users reset to ACTIVE');
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
