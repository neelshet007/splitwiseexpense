import { Response, NextFunction } from 'express';
import { ExpensesService } from './expenses.service';
import { createExpenseSchema, updateExpenseSchema } from '@splitwise/validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { GroupRequest } from '../../middleware/groupAuth.middleware';

export class ExpensesController {
  static async createExpense(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const validated = createExpenseSchema.parse(req.body);
      const groupId = String(req.params.groupId);
      const expense = await ExpensesService.createExpense(groupId, req.user!.id, validated);
      return res.status(201).json({
        success: true,
        data: expense,
        message: 'Expense created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDirectExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createExpenseSchema.parse(req.body);
      const expense = await ExpensesService.createExpense(validated.groupId || null, req.user!.id, validated);
      return res.status(201).json({
        success: true,
        data: expense,
        message: 'Expense created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async listGroupExpenses(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const groupId = String(req.params.groupId);
      const data = await ExpensesService.listGroupExpenses(groupId, page, limit);

      return res.status(200).json({
        success: true,
        data: data.expenses,
        total: data.total,
        page,
        limit
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = String(req.params.expenseId);
      const expense = await ExpensesService.getExpenseById(expenseId);
      return res.status(200).json({
        success: true,
        data: expense
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = updateExpenseSchema.parse(req.body);
      const expenseId = String(req.params.expenseId);
      const expense = await ExpensesService.updateExpense(expenseId, req.user!.id, validated);
      return res.status(200).json({
        success: true,
        data: expense,
        message: 'Expense updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = String(req.params.expenseId);
      await ExpensesService.deleteExpense(expenseId, req.user!.id);
      return res.status(200).json({
        success: true,
        message: 'Expense deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
