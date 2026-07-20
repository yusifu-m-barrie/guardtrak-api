import { PatrolProgressService } from './patrol-progress.service';
import { CheckpointStatus } from '../../../generated/prisma/client';

describe('PatrolProgressService', () => {
  const service = new PatrolProgressService();

  const snaps = [
    { id: 'a', sequence: 1 },
    { id: 'b', sequence: 2 },
    { id: 'c', sequence: 3 },
  ] as never[];

  it('handles empty snapshots', () => {
    const result = service.calculate([], []);
    expect(result.totalCheckpoints).toBe(0);
    expect(result.completionPercentage).toBe(0);
    expect(result.nextCheckpoint).toBeNull();
  });

  it('calculates partial progress and next checkpoint', () => {
    const result = service.calculate(snaps, [
      {
        assignmentCheckpointId: 'a',
        status: CheckpointStatus.COMPLETED,
        patrolCheckpointId: null,
      },
    ]);
    expect(result.completedCheckpoints).toBe(1);
    expect(result.completionPercentage).toBe(33);
    expect(result.nextCheckpoint?.id).toBe('b');
    expect(result.allRequiredComplete).toBe(false);
  });

  it('marks all complete', () => {
    const result = service.calculate(snaps, [
      {
        assignmentCheckpointId: 'a',
        status: CheckpointStatus.COMPLETED,
        patrolCheckpointId: null,
      },
      {
        assignmentCheckpointId: 'b',
        status: CheckpointStatus.COMPLETED,
        patrolCheckpointId: null,
      },
      {
        assignmentCheckpointId: 'c',
        status: CheckpointStatus.COMPLETED,
        patrolCheckpointId: null,
      },
    ]);
    expect(result.allRequiredComplete).toBe(true);
    expect(result.nextCheckpoint).toBeNull();
    expect(result.completionPercentage).toBe(100);
  });
});
