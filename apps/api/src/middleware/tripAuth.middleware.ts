import { Response, NextFunction } from 'express';
import { prisma } from '@splitwise/database';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export interface TripRequest extends AuthenticatedRequest {
  tripMembership?: {
    id: string;
    tripId: string;
    userId: string;
    role: string;
  };
  trip?: {
    id: string;
    name: string;
    createdBy: string;
  };
}

export async function requireTripMember(req: TripRequest, res: Response, next: NextFunction) {
  try {
    const rawTripId = req.params.tripId || req.body.tripId;
    const tripId = rawTripId ? String(rawTripId) : undefined;
    const userId = req.user?.id;

    if (!tripId) {
      throw new NotFoundError('Trip ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('Unauthorized');
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const membership = trip.members[0];

    if (!membership) {
      throw new ForbiddenError('Access denied. You are not a member of this trip.');
    }

    req.tripMembership = membership;
    req.trip = {
      id: trip.id,
      name: trip.name,
      createdBy: trip.createdBy
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireTripAdmin(req: TripRequest, res: Response, next: NextFunction) {
  try {
    const rawTripId = req.params.tripId || req.body.tripId;
    const tripId = rawTripId ? String(rawTripId) : undefined;
    const userId = req.user?.id;

    if (!tripId) {
      throw new NotFoundError('Trip ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('Unauthorized');
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const membership = trip.members[0];

    if (!membership || (membership.role !== 'ADMIN' && trip.createdBy !== userId)) {
      throw new ForbiddenError('Access denied. Only the trip admin can perform this action.');
    }

    req.tripMembership = membership;
    req.trip = {
      id: trip.id,
      name: trip.name,
      createdBy: trip.createdBy
    };

    next();
  } catch (error) {
    next(error);
  }
}
