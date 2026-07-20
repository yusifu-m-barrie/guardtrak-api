/**
 * Generates remaining Phase 6 Nest modules (checkpoints, assignments, visits).
 * Run: node scripts/gen-phase6-rest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log('wrote', rel);
}

// Fix patrols.module to only export shared services (no circular feature imports)
write(
  'src/modules/patrols/patrols-shared.module.ts',
  `import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { PatrolAccessService } from './patrol-access.service';
import { PatrolProgressService } from './patrol-progress.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  providers: [PatrolAccessService, PatrolProgressService],
  exports: [PatrolAccessService, PatrolProgressService],
})
export class PatrolsSharedModule {}
`,
);

// Delete broken patrols.module content - overwrite with re-export
write(
  'src/modules/patrols/patrols.module.ts',
  `export { PatrolsSharedModule as PatrolsModule } from './patrols-shared.module';
`,
);

console.log('shared module fixed');
