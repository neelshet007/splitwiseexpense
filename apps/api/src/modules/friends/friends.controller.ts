import { Response, NextFunction } from 'express';
import { FriendsService } from './friends.service';
import { addFriendSchema, createSettlementSchema } from '@splitwise/validation';
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

  static async getFriendDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friendId = String(req.params.friendId);
      const range = req.query.range ? String(req.query.range) : undefined;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const details = await FriendsService.getFriendRelationshipDetails(
        req.user!.id,
        friendId,
        range,
        startDate,
        endDate
      );

      return res.status(200).json({
        success: true,
        data: details
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friendId = String(req.params.friendId);
      const bodyWithFriend = { ...req.body, friendId };
      const validated = createSettlementSchema.parse(bodyWithFriend);

      const settlement = await FriendsService.createSettlement(req.user!.id, validated);
      return res.status(201).json({
        success: true,
        data: settlement,
        message: 'Settlement recorded successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friendId = String(req.params.friendId);
      const range = req.query.range ? String(req.query.range) : undefined;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const { buffer, filename } = await FriendsService.generateFriendExcel(
        req.user!.id,
        friendId,
        range,
        startDate,
        endDate
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length.toString());

      return res.send(buffer);
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
