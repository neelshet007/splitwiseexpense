import { Router } from 'express';
import { BalancesController } from './balances.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireGroupMember } from '../../middleware/groupAuth.middleware';

// Routes for group balances: mounted on /api/groups/:groupId
export const groupBalancesRouter = Router({ mergeParams: true });
groupBalancesRouter.use(requireAuth);
groupBalancesRouter.use(requireGroupMember);

groupBalancesRouter.get('/balances', BalancesController.getGroupBalances);
groupBalancesRouter.get('/settlements', BalancesController.getGroupSettlements);

// Route for global dashboard: /api/dashboard/summary
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get('/summary', BalancesController.getDashboardSummary);
