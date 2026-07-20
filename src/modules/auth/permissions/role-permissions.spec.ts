import { getPermissionsForRole } from './role-permissions';
import { UserRole } from '../../../common/enums/user-role.enum';

describe('role permissions', () => {
  it('returns officer permissions', () => {
    const permissions = getPermissionsForRole(UserRole.SECURITY_OFFICER);
    expect(permissions).toContain('attendance:create:self');
    expect(permissions).not.toContain('user:manage');
  });

  it('returns admin permissions including audit', () => {
    const permissions = getPermissionsForRole(UserRole.ADMINISTRATOR);
    expect(permissions).toContain('audit:read');
    expect(permissions).toContain('shift:manage');
  });

  it('gives platform manage to super admin only', () => {
    expect(getPermissionsForRole(UserRole.SUPER_ADMIN)).toContain(
      'platform:manage',
    );
    expect(getPermissionsForRole(UserRole.ADMINISTRATOR)).not.toContain(
      'platform:manage',
    );
  });
});
