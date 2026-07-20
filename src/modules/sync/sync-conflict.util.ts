export interface SyncConflictDetectionInput {
  operationId: string;
  entityType: string;
  localEntityId?: string | null;
  existingServerEntityId?: string | null;
  payloadChanged?: boolean;
}

export interface SyncConflictDetectionResult {
  isConflict: boolean;
  reasonCode?: string;
  message?: string;
}

/**
 * Detects offline sync conflicts for replayed operations.
 * Conflict when same local entity maps to a different server entity,
 * or idempotent replay arrives with a changed payload hash already handled upstream.
 */
export function detectSyncConflict(
  input: SyncConflictDetectionInput,
): SyncConflictDetectionResult {
  if (
    input.localEntityId &&
    input.existingServerEntityId &&
    input.payloadChanged
  ) {
    return {
      isConflict: true,
      reasonCode: 'PAYLOAD_DIVERGED',
      message: `Local entity ${input.localEntityId} already synced with divergent payload`,
    };
  }
  if (input.payloadChanged && input.existingServerEntityId) {
    return {
      isConflict: true,
      reasonCode: 'IDEMPOTENT_PAYLOAD_MISMATCH',
      message: `Operation ${input.operationId} replayed with different payload`,
    };
  }
  return { isConflict: false };
}
