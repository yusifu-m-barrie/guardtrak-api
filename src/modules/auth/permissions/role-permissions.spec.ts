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

  it('gives supervisors team view without assignment create; keeps report:read for home widgets', () => {
    const permissions = getPermissionsForRole(UserRole.SUPERVISOR);
    expect(permissions).toContain('assignment:read');
    expect(permissions).not.toContain('assignment:create');
    expect(permissions).not.toContain('assignment:update');
    expect(permissions).not.toContain('assignment:cancel');
    expect(permissions).not.toContain('patrol-assignment:create');
    expect(permissions).toContain('report:read');
    expect(permissions).toContain('patrol-route:read');
    expect(permissions).toContain('site:read');
    expect(permissions).toContain('shift:read');
    expect(permissions).not.toContain('supervisor:assign-officer');
    expect(permissions).not.toContain('shift:create');
    expect(permissions).not.toContain('client:read');
    expect(permissions).toContain('supervisor:read');
    expect(permissions).not.toContain('organisation:update:self');
  });
});
