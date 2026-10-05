import { Router } from 'express';
import { TelegramController } from './telegram.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Webhook endpoint (unauthenticated for user, authenticated via Telegram Secret Header)
router.post('/webhook', TelegramController.handleWebhook);
router.get('/setup-webhook', TelegramController.setupWebhook);

// User-facing endpoints
router.get('/status', requireAuth, TelegramController.getStatus);
router.post('/connect', requireAuth, TelegramController.connect);
router.delete('/disconnect', requireAuth, TelegramController.disconnect);
router.patch('/username', requireAuth, TelegramController.updateUsername);
router.patch('/preferences', requireAuth, TelegramController.updatePreferences);

export default router;
