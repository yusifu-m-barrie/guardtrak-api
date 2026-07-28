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

  it('gives supervisors scoped create for assignments and patrols', () => {
    const permissions = getPermissionsForRole(UserRole.SUPERVISOR);
    expect(permissions).toContain('assignment:create');
    expect(permissions).toContain('patrol-assignment:create');
    expect(permissions).toContain('patrol-route:read');
    expect(permissions).not.toContain('supervisor:assign-officer');
    expect(permissions).not.toContain('shift:create');
  });
});
