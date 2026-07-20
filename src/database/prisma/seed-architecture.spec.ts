import { readFileSync } from 'fs';
import { join } from 'path';

describe('seed architecture', () => {
  const seedSource = readFileSync(
    join(__dirname, '../../../prisma/seed.ts'),
    'utf8',
  );

  it('hashes passwords with argon2 and does not embed plaintext passwordHash values', () => {
    expect(seedSource).toContain("import * as argon2 from 'argon2'");
    expect(seedSource).toContain('argon2.hash');
    expect(seedSource).not.toMatch(/passwordHash:\s*['"]GuardTrak/);
  });

  it('uses upsert for idempotent organisation and users', () => {
    expect(seedSource).toContain('organisation.upsert');
    expect(seedSource).toContain('upsertUser');
  });
});
