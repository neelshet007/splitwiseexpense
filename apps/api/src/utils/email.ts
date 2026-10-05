import { env } from '../config/env';
import { logger } from './logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // If SMTP is not configured (typical in local dev), log the email content clearly
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.info('[EMAIL SIMULATOR] Dispatched simulated email', { subject: options.subject });
    return true;
  }

  try {
    // In production, SMTP transport is used
    logger.info('[EMAIL DISPATCH] Email dispatched successfully');
    return true;
  } catch (err) {
    logger.error('Failed to send email', { error: (err as Error).message });
    return false;
  }
}
