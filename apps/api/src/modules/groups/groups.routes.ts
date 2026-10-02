import { Router } from 'express';
import { GroupsController } from './groups.controller';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware';
import { requireGroupMember } from '../../middleware/groupAuth.middleware';

const router = Router();

// Public / optional preview for shareable invites
router.get('/invite/:inviteCode', optionalAuth, GroupsController.getGroupPreview);

// All following routes require authentication
router.use(requireAuth);

// Idempotent join via human-friendly invite code
router.post('/join', GroupsController.joinGroup);

router.get('/', GroupsController.listUserGroups);
router.post('/', GroupsController.createGroup);

// Sub-routes requiring strict group authorization
router.get('/:groupId', requireGroupMember, GroupsController.getGroup);
router.post('/:groupId/members', requireGroupMember, GroupsController.addMember);
router.delete('/:groupId/members/:userId', requireGroupMember, GroupsController.removeMember);

export default router;
