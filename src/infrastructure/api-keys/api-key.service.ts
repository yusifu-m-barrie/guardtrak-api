import { Injectable } from '@nestjs/common';

export interface CreateApiKeyInput {
  organisationId: string;
  name: string;
  scopes?: string[];
}

export interface CreateApiKeyResult {
  id: string;
  key: string;
  prefix: string;
}

/**
 * Placeholder for future API key management.
 * Phase 8 wires the module so the application compiles.
 */
@Injectable()
export class ApiKeyService {
  /**
   * Validates an API key against persistent storage.
   * Not implemented in Phase 8 — always returns false.
   */
  validateApiKey(apiKey: string): boolean {
    void apiKey;
    return false;
  }

  /**
   * Creates a new organisation-scoped API key.
   * Not implemented in Phase 8.
   */
  createApiKey(input: CreateApiKeyInput): CreateApiKeyResult {
    void input;
    throw new Error('API key creation is not implemented');
  }
}
