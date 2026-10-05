import { Response, NextFunction } from 'express';
import { TripsService } from './trips.service';
import {
  createTripSchema,
  updateTripSchema,
  addTripMemberSchema,
  joinTripSchema,
  recordTripSettlementSchema
} from '@splitwise/validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { TripRequest } from '../../middleware/tripAuth.middleware';
import { prisma } from '@splitwise/database';
import { AuthService } from '../auth/auth.service';

export class TripsController {
  static async createTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createTripSchema.parse(req.body);
      const trip = await TripsService.createTrip(req.user!.id, validated);
      return res.status(201).json({
        success: true,
        data: trip,
        message: 'Trip created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUserTrips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const trips = await TripsService.listUserTrips(req.user!.id);
      return res.status(200).json({
        success: true,
        data: trips
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTrip(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const trip = await TripsService.getTripById(tripId);
      return res.status(200).json({
        success: true,
        data: trip
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTrip(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const validated = updateTripSchema.parse(req.body);
      const trip = await TripsService.updateTrip(tripId, req.user!.id, validated);
      return res.status(200).json({
        success: true,
        data: trip,
        message: 'Trip updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTrip(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      await TripsService.deleteTrip(tripId, req.user!.id);
      return res.status(200).json({
        success: true,
        message: 'Trip deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async regenerateInviteCode(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const result = await TripsService.regenerateInviteCode(tripId, req.user!.id);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Invite code regenerated'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTripPreview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const inviteCode = String(req.params.inviteCode);
      const preview = await TripsService.getTripPreview(inviteCode, req.user?.id);
      return res.status(200).json({
        success: true,
        data: preview
      });
    } catch (error) {
      next(error);
    }
  }

  static async joinTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = joinTripSchema.parse(req.body);
      const result = await TripsService.joinTripByInviteCode(req.user!.id, validated);
      return res.status(200).json({
        success: true,
        data: result.trip,
        alreadyMember: result.alreadyMember,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  static async addMember(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const validated = addTripMemberSchema.parse(req.body);
      const trip = await TripsService.addMember(tripId, validated);
      return res.status(200).json({
        success: true,
        data: trip,
        message: 'Member added to trip'
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const memberUserId = String(req.params.userId);
      await TripsService.removeMember(tripId, memberUserId, req.user!.id);
      return res.status(200).json({
        success: true,
        message: 'Member removed from trip'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTripBalances(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const balances = await TripsService.calculateTripBalances(tripId, req.user!.id);
      return res.status(200).json({
        success: true,
        data: balances
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTripSettlements(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const settlements = await TripsService.getTripSettlements(tripId, req.user!.id);
      return res.status(200).json({
        success: true,
        data: settlements
      });
    } catch (error) {
      next(error);
    }
  }

  static async recordTripSettlement(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const validated = recordTripSettlementSchema.parse(req.body);
      const settlement = await TripsService.recordTripSettlement(tripId, req.user!.id, validated);
      return res.status(201).json({
        success: true,
        data: settlement,
        message: 'Trip settlement recorded successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTripExpenses(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const expenses = await prisma.expense.findMany({
        where: { tripId },
        include: {
          payer: true,
          creator: true,
          splits: {
            include: { user: true }
          }
        },
        orderBy: { expenseDate: 'desc' }
      });

      const formatted = expenses.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        tripId: e.tripId,
        description: e.description,
        totalAmount: e.totalAmount,
        splitType: e.splitType,
        paidBy: e.paidBy,
        createdBy: e.createdBy,
        expenseDate: e.expenseDate.toISOString(),
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        payer: AuthService.toSafeUser(e.payer),
        creator: AuthService.toSafeUser(e.creator),
        splits: e.splits.map((s) => ({
          id: s.id,
          expenseId: s.expenseId,
          userId: s.userId,
          amountOwed: s.amountOwed,
          user: s.user ? AuthService.toSafeUser(s.user) : undefined
        }))
      }));

      return res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportTripToExcel(req: TripRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId);
      const buffer = await TripsService.exportTripToExcel(tripId);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="trip-${tripId}-ledger.xlsx"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
