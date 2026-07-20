import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../src/common/types/api-response.type';

export function asSuccessBody<T>(body: unknown): ApiSuccessResponse<T> {
  return body as ApiSuccessResponse<T>;
}

export function asErrorBody(body: unknown): ApiErrorResponse {
  return body as ApiErrorResponse;
}
