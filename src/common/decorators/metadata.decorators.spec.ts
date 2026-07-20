import { IS_PUBLIC_KEY, ROLES_KEY } from '../constants/metadata-keys';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { UserRole } from '../enums/user-role.enum';

describe('route metadata decorators', () => {
  it('sets public route metadata', () => {
    class DemoController {
      @Public()
      publicRoute(): string {
        return 'public';
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      DemoController.prototype,
      'publicRoute',
    );
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      descriptor?.value as object,
    ) as boolean;
    expect(isPublic).toBe(true);
  });

  it('sets roles metadata', () => {
    class DemoController {
      @Roles(UserRole.SUPERVISOR, UserRole.ADMINISTRATOR)
      protectedRoute(): string {
        return 'protected';
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      DemoController.prototype,
      'protectedRoute',
    );
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      descriptor?.value as object,
    ) as UserRole[];
    expect(roles).toEqual([UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]);
  });
});
