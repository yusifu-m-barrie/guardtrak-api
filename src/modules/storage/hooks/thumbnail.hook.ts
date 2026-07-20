export interface ThumbnailHook {
  generate(storageKey: string, mimeType: string): Promise<void>;
}

export class NoOpThumbnailHook implements ThumbnailHook {
  generate(storageKey: string, mimeType: string): Promise<void> {
    void storageKey;
    void mimeType;
    return Promise.resolve();
  }
}

export const THUMBNAIL_HOOK = Symbol('THUMBNAIL_HOOK');
