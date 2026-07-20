import type { Request } from 'express';
import type { RequestUser } from './request-user.type';

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  requestId: string;
}
