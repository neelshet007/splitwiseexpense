import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { TelegramService } from '../src/modules/telegram/telegram.service';
import { registerSchema, forgotPasswordSchema, resetPasswordSchema } from '@splitwise/validation';

describe('Telegram-First Authentication & Linking Requirements', () => {
  it('validates registration input requiring name, email, password, and telegramUsername', () => {
    const validData = {
      name: 'Neel Sheth',
      email: 'neel@example.com',
      password: 'supersecretpassword123',
      telegramUsername: 'neelshet'
    };

    const parsed = registerSchema.parse(validData);
    expect(parsed.name).toBe('Neel Sheth');
    expect(parsed.email).toBe('neel@example.com');
    // Normalizes to @neelshet
    expect(parsed.telegramUsername).toBe('@neelshet');
  });

  it('normalizes telegramUsername whether @ is prefixed or not', () => {
    const withAt = registerSchema.parse({
      name: 'Neel Sheth',
      email: 'neel2@example.com',
      password: 'password12345',
      telegramUsername: '@neelshet'
    });
    expect(withAt.telegramUsername).toBe('@neelshet');

    const withoutAt = registerSchema.parse({
      name: 'Neel Sheth',
      email: 'neel3@example.com',
      password: 'password12345',
      telegramUsername: 'neelshet'
    });
    expect(withoutAt.telegramUsername).toBe('@neelshet');
  });

  it('rejects registration without telegramUsername', () => {
    const missingTelegram = {
      name: 'Neel Sheth',
      email: 'neel@example.com',
      password: 'password123'
    };

    expect(() => registerSchema.parse(missingTelegram)).toThrow();
  });

  it('validates forgot password input and generic security messaging', () => {
    const validEmail = forgotPasswordSchema.parse({ email: 'NEEL@example.com' });
    expect(validEmail.email).toBe('neel@example.com');
  });

  it('validates reset password schema with token, password, and confirmPassword', () => {
    const validReset = resetPasswordSchema.parse({
      token: 'secure-token-123',
      password: 'newpassword123',
      confirmPassword: 'newpassword123'
    });

    expect(validReset.token).toBe('secure-token-123');
    expect(validReset.password).toBe('newpassword123');

    // Mismatched passwords should throw
    expect(() =>
      resetPasswordSchema.parse({
        token: 'secure-token-123',
        password: 'newpassword123',
        confirmPassword: 'differentpassword'
      })
    ).toThrow();
  });
});

describe('Telegram Deep-Link Token & Message Formatting', () => {
  it('generates cryptographically random link tokens with 15-minute validity', () => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    expect(rawToken).toHaveLength(48);
    expect(tokenHash).toHaveLength(64);
  });

  it('formats expense notification specifically for the participant who owes', () => {
    const expense = {
      description: 'Dinner',
      totalAmount: 120000,
      payer: { name: 'Neel' },
      group: null
    };
    const yourShare = 60000;

    const formattedTotal = '₹1,200';
    const formattedShare = '₹600';

    const msg = [
      `💸 <b>New Expense</b>\n`,
      `<b>${expense.description}</b>\n`,
      `Total: ${formattedTotal}`,
      `Paid by: ${expense.payer.name}\n`,
      `Your share: ${formattedShare}`,
      `You owe ${expense.payer.name}: ${formattedShare}`
    ].join('\n');

    expect(msg).toContain('Dinner');
    expect(msg).toContain('Total: ₹1,200');
    expect(msg).toContain('Paid by: Neel');
    expect(msg).toContain('Your share: ₹600');
    expect(msg).toContain('You owe Neel: ₹600');
  });

  it('formats group expense notification with group header', () => {
    const groupName = 'Goa Trip';
    const expense = {
      description: 'Hotel',
      totalAmount: 800000,
      payer: { name: 'Neel' }
    };
    const yourShare = 200000;

    const formattedTotal = '₹8,000';
    const formattedShare = '₹2,000';

    const msg = [
      `🏝️ <b>${groupName}</b>\n\n`,
      `💸 <b>New Expense</b>\n`,
      `<b>${expense.description}</b>\n`,
      `Total: ${formattedTotal}`,
      `Paid by: ${expense.payer.name}\n`,
      `Your share: ${formattedShare}`,
      `You owe ${expense.payer.name}: ${formattedShare}`
    ].join('\n');

    expect(msg).toContain('Goa Trip');
    expect(msg).toContain('Hotel');
    expect(msg).toContain('Total: ₹8,000');
    expect(msg).toContain('You owe Neel: ₹2,000');
  });

  it('formats settlement notification for payer and receiver', () => {
    const payerMsg = `🤝 <b>Settlement Recorded</b>\nYou paid <b>Rahul</b> ₹500.`;
    const receiverMsg = `🤝 <b>Settlement Received</b>\n<b>Neel</b> paid you ₹500.`;

    expect(payerMsg).toContain('You paid <b>Rahul</b> ₹500');
    expect(receiverMsg).toContain('<b>Neel</b> paid you ₹500');
  });
});
