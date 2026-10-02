# Security Specification & Guidelines

## 1. Threat Model & Defense In Depth

This is a private expense-sharing application for a closed group of 10–20 friends. While not exposed to public registration attacks, security must adhere to production-grade principles to protect financial data, passwords, and user identities.

---

## 2. Authentication & Credential Storage

### Password Hashing (Argon2id)
- Passwords are encrypted exclusively using **Argon2id** (memory-hard, resistant to GPU/ASIC and side-channel timing attacks).
- Memory cost: 65,536 KB (64 MB), Time cost: 3 iterations, Parallelism: 4 threads.
- Raw passwords are NEVER written to logs, stored in the database, or returned in API payloads.

### Session Management
- Authentication uses **HTTP-Only, Secure, SameSite=Lax** cookies storing signed cryptographic session tokens (or short-lived JWT with rolling validation).
- Prevents Cross-Site Scripting (XSS) token theft via JavaScript `document.cookie`.
- `Secure` flag enabled automatically in production (HTTPS).
- Cookie path restricted to `/api`.

### Rate Limiting
- Brute-force protection applied to authentication endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`):
  - Limit: 5 requests per 15-minute window per IP for login/register.
  - Limit: 3 requests per hour for password reset requests.
  - Returns standard `429 Too Many Requests`.

---

## 3. Strict Server-Side Authorization

Never trust client-supplied IDs or client-side permissions:

1. **Group Scoping**:
   Every endpoint with `/api/groups/:groupId` or child resources executes the `requireGroupMember` middleware:
   ```text
   Session Authenticated? ──(No)──> 401 Unauthorized
            │
            ▼
   User is active member of groupId? ──(No)──> 403 Forbidden
            │
            ▼
   Proceed to handler
   ```
2. **Horizontal Privilege Escalation Prevention**:
   Changing `:groupId` in the URL or payload will immediately fail with `403 Forbidden` if the authenticated user is not an active member.
3. **Expense Deletion/Editing**:
   Only the creator of the expense, payer, or group admin can edit or remove the expense.

---

## 4. Password Reset Flow Security

- **Timing Attack & Enumeration Resistance**:
  The `/api/auth/forgot-password` endpoint always returns:
  `{ "success": true, "message": "If this email is registered, a password reset link has been dispatched." }`
  regardless of whether the email exists in the database.
- **Token Security**:
  - Generated using `crypto.randomBytes(32).toString('hex')`.
  - Sent in reset link: `https://app.example.com/reset-password?token=<raw_token>`.
  - Stored in database ONLY as `SHA-256(raw_token)`.
  - Single-use constraint: immediately marked `usedAt = now()`.
  - Expiration: strictly 60 minutes from creation.

---

## 5. Telegram Integration Security

### Deep-Link Connection Flow (Zero OTP)
- The user clicks "Connect Telegram" on the web app.
- Backend generates a temporary 32-byte hex token valid for 15 minutes.
- User is redirected to `https://t.me/<BotUsername>?start=<token>`.
- In the Telegram `/start <token>` webhook callback:
  1. Backend hashes the token with SHA-256.
  2. Matches valid, unexpired token in `TelegramConnectToken`.
  3. Updates User record with `telegramChatId` and `telegramUsername`.
  4. Deletes/invalidates the temporary token.
- No phone numbers, passwords, or OTPs are ever transmitted.

### Webhook Verification
- Telegram webhook requests are validated using the `X-Telegram-Bot-Api-Secret-Token` header matching `TELEGRAM_WEBHOOK_SECRET`.
- Unauthorized webhook payloads are immediately rejected with `401 Unauthorized`.

---

## 6. Input Validation & Injection Prevention

- **SQL Injection**: Handled automatically via Prisma ORM parameterized queries. Raw queries (`$queryRawUnsafe`) are strictly forbidden.
- **Request Body Validation**: Every endpoint enforces strict Zod validation on incoming payloads (`req.body`, `req.query`, `req.params`). Unexpected fields are stripped.
- **Financial Validation**:
  - Amounts must be positive non-zero integers.
  - Split sum must strictly match total amount to the penny/paise.
  - All split participants must be valid group members.

---

## 7. Logging & Secrets Sanitation

- Logs use structured JSON format (method, path, status, duration, requestId).
- Redaction policy:
  - Headers: `Authorization`, `Cookie`, `Set-Cookie` are redacted.
  - Body keys: `password`, `confirmPassword`, `token`, `secret`, `apiKey` are sanitized to `[REDACTED]`.
  - Bot tokens and database credentials are kept strictly in `.env`.
