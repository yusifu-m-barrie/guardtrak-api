import type { UserRole } from '../enums/user-role.enum';
import type { AccountStatus } from '../enums/account-status.enum';

/**
 * Authenticated principal attached to the request after JWT validation.
 * Never accept these values from client headers/body.
 */
export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  organisationId: string | null;
  employeeId: string | null;
  sessionId: string;
  deviceId: string | null;
  permissions: string[];
}
