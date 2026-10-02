import { Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { updateProfileSchema } from '@splitwise/validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class UsersController {
  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.getProfile(req.user!.id);
      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = updateProfileSchema.parse(req.body);
      const user = await UsersService.updateProfile(req.user!.id, validated);
      return res.status(200).json({
        success: true,
        data: user,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
