export interface VirusScanHook {
  scan(storageKey: string): Promise<void>;
}

export class NoOpVirusScanHook implements VirusScanHook {
  scan(storageKey: string): Promise<void> {
    void storageKey;
    return Promise.resolve();
  }
}

export const VIRUS_SCAN_HOOK = Symbol('VIRUS_SCAN_HOOK');
