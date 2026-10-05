import dotenv from 'dotenv';
import path from 'path';

// Load local apps/api/.env first, then root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const clean = (val?: string) => (val ? val.trim().replace(/^["']|["']$/g, '') : '');

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  APP_URL: clean(process.env.APP_URL) || 'http://localhost:3000',
  API_URL: clean(process.env.API_URL || process.env.RENDER_EXTERNAL_URL) || 'http://localhost:4000',
  DATABASE_URL: clean(process.env.DATABASE_URL) || 'postgresql://postgres:postgrespassword@localhost:5432/splitwise_db?schema=public',
  SESSION_SECRET: clean(process.env.SESSION_SECRET) || 'dev-super-secure-session-secret-min-32-chars-long!',
  SESSION_EXPIRY_DAYS: parseInt(process.env.SESSION_EXPIRY_DAYS || '7', 10),
  SMTP_HOST: clean(process.env.SMTP_HOST),
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: clean(process.env.SMTP_USER),
  SMTP_PASSWORD: clean(process.env.SMTP_PASSWORD),
  EMAIL_FROM: clean(process.env.EMAIL_FROM) || 'Splitwise Private <noreply@splitwise.local>',
  TELEGRAM_BOT_TOKEN: clean(process.env.TELEGRAM_BOT_TOKEN),
  TELEGRAM_BOT_USERNAME: clean(process.env.TELEGRAM_BOT_USERNAME),
  TELEGRAM_WEBHOOK_SECRET: clean(process.env.TELEGRAM_WEBHOOK_SECRET),
  MONTHLY_SUMMARY_CRON: clean(process.env.MONTHLY_SUMMARY_CRON) || '0 0 1 * *',
  TIMEZONE: clean(process.env.TIMEZONE) || 'Asia/Kolkata',
  isProduction: process.env.NODE_ENV === 'production'
};
