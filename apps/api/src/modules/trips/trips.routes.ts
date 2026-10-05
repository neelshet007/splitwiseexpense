import { Router } from 'express';
import { TripsController } from './trips.controller';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware';
import { requireTripMember, requireTripAdmin } from '../../middleware/tripAuth.middleware';

const router = Router();

// Public / optional preview for shareable trip invites
router.get('/invite/:inviteCode', optionalAuth, TripsController.getTripPreview);

// All following routes require authentication
router.use(requireAuth);

// Idempotent join via human-friendly invite code (e.g. GOA-7K4P2X)
router.post('/join', TripsController.joinTrip);

router.get('/', TripsController.listUserTrips);
router.post('/', TripsController.createTrip);

// Sub-routes requiring strict trip member authorization
router.get('/:tripId', requireTripMember, TripsController.getTrip);
router.put('/:tripId', requireTripMember, requireTripAdmin, TripsController.updateTrip);
router.delete('/:tripId', requireTripMember, requireTripAdmin, TripsController.deleteTrip);
router.post('/:tripId/invite/regenerate', requireTripMember, requireTripAdmin, TripsController.regenerateInviteCode);

router.post('/:tripId/members', requireTripMember, TripsController.addMember);
router.delete('/:tripId/members/:userId', requireTripMember, TripsController.removeMember);

router.get('/:tripId/expenses', requireTripMember, TripsController.getTripExpenses);
router.get('/:tripId/balances', requireTripMember, TripsController.getTripBalances);
router.get('/:tripId/settlements', requireTripMember, TripsController.getTripSettlements);
router.post('/:tripId/settlements', requireTripMember, TripsController.recordTripSettlement);
router.get('/:tripId/export', requireTripMember, TripsController.exportTripToExcel);

export default router;
