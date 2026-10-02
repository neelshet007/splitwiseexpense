import { Router } from 'express';
import { ExpensesController } from './expenses.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireGroupMember } from '../../middleware/groupAuth.middleware';

// Router for /api/groups/:groupId/expenses
export const groupExpensesRouter = Router({ mergeParams: true });
groupExpensesRouter.use(requireAuth);
groupExpensesRouter.use(requireGroupMember);

groupExpensesRouter.get('/', ExpensesController.listGroupExpenses);
groupExpensesRouter.post('/', ExpensesController.createExpense);

// Router for /api/expenses
export const directExpensesRouter = Router();
directExpensesRouter.use(requireAuth);

directExpensesRouter.post('/', ExpensesController.createDirectExpense);
directExpensesRouter.get('/:expenseId', ExpensesController.getExpense);
directExpensesRouter.patch('/:expenseId', ExpensesController.updateExpense);
directExpensesRouter.delete('/:expenseId', ExpensesController.deleteExpense);
