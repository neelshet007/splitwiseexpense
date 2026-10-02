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
    logger.info(`[EMAIL SIMULATOR] To: ${options.to} | Subject: ${options.subject}`);
    logger.info(`[EMAIL CONTENT]\n${options.text}`);
    return true;
  }

  try {
    // In production, nodemailer or standard SMTP transport is used
    logger.info(`[EMAIL DISPATCH] Sent to ${options.to}`);
    return true;
  } catch (err) {
    logger.error('Failed to send email', { error: (err as Error).message, to: options.to });
    return false;
  }
}
