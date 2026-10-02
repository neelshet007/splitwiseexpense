import { Router } from 'express';
import { FriendsController } from './friends.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', FriendsController.listFriends);
router.post('/add', FriendsController.addFriend);
router.get('/:friendId/expenses', FriendsController.getDirectExpenses);

export default router;
