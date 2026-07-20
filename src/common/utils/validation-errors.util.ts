import type { ValidationError } from 'class-validator';
import type { ApiErrorDetail } from '../types/api-response.type';

export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        details.push({
          field,
          message,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (error.children && error.children.length > 0) {
      details.push(...formatValidationErrors(error.children, field));
    }
  }

  return details;
}

export function formatNestValidationMessages(
  messages: string[] | string,
): ApiErrorDetail[] {
  if (Array.isArray(messages)) {
    return messages.map((message) => ({
      message: String(message),
      code: 'VALIDATION_ERROR',
    }));
  }

  if (typeof messages === 'string') {
    return [{ message: messages, code: 'VALIDATION_ERROR' }];
  }

  return [{ message: 'Validation failed', code: 'VALIDATION_ERROR' }];
}
