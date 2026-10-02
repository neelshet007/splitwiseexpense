import { Router } from 'express';
import { UsersController } from './users.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/me', UsersController.getMe);
router.patch('/me', UsersController.updateMe);

export default router;
