import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/constants/error-codes';
import { HttpStatus } from '@nestjs/common';

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async needsRehash(hash: string): Promise<boolean> {
    try {
      return await Promise.resolve(argon2.needsRehash(hash));
    } catch {
      return false;
    }
  }

  scoreStrength(password: string): PasswordStrengthResult {
    let score = 0;
    if (password.length >= 10) score += 1;
    if (password.length >= 14) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
    const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
    const labels: PasswordStrengthResult['label'][] = [
      'weak',
      'fair',
      'good',
      'strong',
      'excellent',
    ];
    return { score: clamped, label: labels[clamped] };
  }

  validatePolicy(password: string): PasswordPolicyResult {
    const errors: string[] = [];

    if (password !== password.trim()) {
      errors.push('Password must not start or end with whitespace');
    }
    if (password.length < 10) {
      errors.push('Password must be at least 10 characters');
    }
    if (password.length > 128) {
      errors.push('Password must be at most 128 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must include an uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must include a lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must include a number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must include a symbol');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      password === 'GuardTrak!Dev2026'
    ) {
      errors.push('This password is not allowed in production');
    }

    return { valid: errors.length === 0, errors };
  }

  assertPolicy(password: string): void {
    const result = this.validatePolicy(password);
    if (!result.valid) {
      throw new AppException(
        'Password does not meet security requirements',
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_PASSWORD_POLICY_FAILED,
        result.errors.map((message) => ({
          field: 'newPassword',
          message,
          code: ErrorCode.AUTH_PASSWORD_POLICY_FAILED,
        })),
      );
    }
  }
}
