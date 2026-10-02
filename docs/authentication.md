# Authentication & Password Reset Flow

## 1. Registration & Login Flow

```
[Client]                                  [Backend]
   │                                         │
   ├────── POST /api/auth/register ─────────►│
   │       { name, email, password }         │ 1. Validate inputs (Zod)
   │                                         │ 2. Hash password with Argon2id
   │                                         │ 3. Create User record
   │                                         │ 4. Issue signed session cookie
   │◄───── Set-Cookie: session_token ────────┤
   │       { user }                          │
   │                                         │
   ├────── POST /api/auth/login ────────────►│
   │       { email, password }               │ 1. Fetch user by email
   │                                         │ 2. Verify Argon2id hash
   │                                         │ 3. Issue signed session cookie
   │◄───── Set-Cookie: session_token ────────┤
   │       { user }                          │
```

## 2. Password Reset Flow (Email-based, No OTP)

```
[User]               [Client]                 [Backend API]                    [SMTP]
  │                     │                          │                             │
  │── Enters email ────►│                          │                             │
  │                     │── POST /forgot-pwd ─────►│                             │
  │                     │                          │ 1. Find user (or no-op)     │
  │                     │                          │ 2. crypto.randomBytes(32)   │
  │                     │                          │ 3. Store SHA-256 hash       │
  │                     │                          │ 4. Dispatch email ─────────►│
  │                     │◄── 200 OK (Generic) ─────┤                             │
  │                                                                              │
  │◄──────────────── Receive email with link: /reset-password?token=XYZ ─────────┘
  │
  │── Opens link ──────►│
  │   Enters new pwd    │── POST /reset-pwd ──────►│
  │                     │   { token, newPassword } │ 1. Hash incoming token
  │                     │                          │ 2. Match unexpired token
  │                     │                          │ 3. Update passwordHash
  │                     │                          │ 4. Mark token usedAt
  │                     │◄── 200 OK Password Reset─┤
```

## 3. Session Security Attributes

- `HttpOnly`: true (not accessible via JavaScript `document.cookie`)
- `SameSite`: "lax" (protection against CSRF on top-level navigations)
- `Secure`: true in production (HTTPS only)
- `Path`: "/"
- `Max-Age`: 7 days (or configurable session window)
