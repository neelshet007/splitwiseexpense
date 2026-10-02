# Telegram Bot Integration

## 1. Deep-Linking Connection (Zero OTP)

Instead of asking users for phone numbers or SMS OTPs, authentication leverages Telegram's official bot deep-link standard:

```
[User on Web]                                  [Backend API]                    [Telegram Bot API]
     │                                               │                                   │
     ├── Clicks "Connect Telegram" ─────────────────►│                                   │
     │                                               │ 1. Generate random hex token      │
     │                                               │ 2. Store SHA-256 hash in DB       │
     │◄── Return: https://t.me/Bot?start=RAW_TOKEN ──┤                                   │
     │                                                                                   │
     ├── Opens Telegram App & taps "Start" ─────────────────────────────────────────────►│
     │                                                                                   │
     │                                               │◄── Webhook POST /telegram/webhook ┤
     │                                               │    Message: "/start RAW_TOKEN"    │
     │                                               │    From: { id: 12345, username }  │
     │                                               │                                   │
     │                                               │ 1. Hash incoming token            │
     │                                               │ 2. Find valid token in DB         │
     │                                               │ 3. Link user.telegramChatId       │
     │                                               │ 4. Delete temporary token         │
     │                                               │ 5. Send Telegram confirmation ───►│
     │◄── Telegram Message: "Account linked!" ───────────────────────────────────────────┤
```

---

## 2. Real-Time Expense Alerts

When an expense is committed in the database:
1. Identify all members in the group who have `telegramConnected: true` and a valid `telegramChatId`.
2. Format a clean, human-readable notification:
   - For payer: "You paid ₹X, your share is ₹Y, you are owed ₹Z."
   - For others: "New expense 'Dinner', total ₹X paid by Neel. Your share is ₹Y."
3. Send via `sendMessage` API asynchronously.
4. If Telegram fails (e.g. user blocked bot or network error), log error safely; NEVER fail the financial transaction.

---

## 3. Scheduled Monthly Summary

At 00:00 on the 1st of each month (or scheduled cron):
1. Query active groups with activity in the preceding month.
2. Calculate total expenses, user's paid amount, user's share, and simplified net debt transfers.
3. Check `MonthlySummaryLog` to prevent duplicate dispatch.
4. Send personalized summary message to all connected members.
