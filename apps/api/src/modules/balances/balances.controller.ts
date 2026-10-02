import { Response, NextFunction } from 'express';
import { BalanceService } from './balances.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { GroupRequest } from '../../middleware/groupAuth.middleware';

export class BalancesController {
  static async getGroupBalances(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const groupId = String(req.params.groupId);
      const data = await BalanceService.calculateGroupBalances(groupId);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGroupSettlements(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const groupId = String(req.params.groupId);
      const data = await BalanceService.calculateGroupSettlements(groupId);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await BalanceService.getUserDashboardSummary(req.user!.id);
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
}
