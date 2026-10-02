import { prisma } from '@splitwise/database';
import { AuthService } from '../auth/auth.service';
import { SafeUser } from '@splitwise/types';
import { NotFoundError } from '../../utils/errors';
import { UpdateProfileInput } from '@splitwise/validation';

export class UsersService {
  static async getProfile(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return AuthService.toSafeUser(user);
  }

  static async updateProfile(userId: string, data: UpdateProfileInput): Promise<SafeUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name.trim()
      }
    });

    return AuthService.toSafeUser(user);
  }
}
