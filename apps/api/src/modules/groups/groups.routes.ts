import { Router } from 'express';
import { GroupsController } from './groups.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireGroupMember } from '../../middleware/groupAuth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', GroupsController.listUserGroups);
router.post('/', GroupsController.createGroup);

// Sub-routes requiring strict group authorization
router.get('/:groupId', requireGroupMember, GroupsController.getGroup);
router.post('/:groupId/members', requireGroupMember, GroupsController.addMember);
router.delete('/:groupId/members/:userId', requireGroupMember, GroupsController.removeMember);

export default router;
