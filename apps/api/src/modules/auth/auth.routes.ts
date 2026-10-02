import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authLimiter, passwordResetLimiter } from '../../middleware/rateLimiter.middleware';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', passwordResetLimiter, AuthController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, AuthController.resetPassword);
router.get('/me', requireAuth, AuthController.me);

export default router;
