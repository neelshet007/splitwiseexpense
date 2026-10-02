import { Response, NextFunction } from 'express';
import { FriendsService } from './friends.service';
import { addFriendSchema } from '@splitwise/validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class FriendsController {
  static async listFriends(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friends = await FriendsService.listFriends(req.user!.id);
      return res.status(200).json({
        success: true,
        data: friends
      });
    } catch (error) {
      next(error);
    }
  }

  static async addFriend(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = addFriendSchema.parse(req.body);
      const friend = await FriendsService.addFriend(req.user!.id, validated.email);
      return res.status(201).json({
        success: true,
        data: friend,
        message: 'Friend added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDirectExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friendId = String(req.params.friendId);
      const expenses = await FriendsService.getDirectExpenses(req.user!.id, friendId);
      return res.status(200).json({
        success: true,
        data: expenses
      });
    } catch (error) {
      next(error);
    }
  }
}
