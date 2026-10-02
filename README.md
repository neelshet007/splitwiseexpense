# Splitwise Private 💸

> A production-ready, mobile-first private expense splitting application designed for a circle of 10–20 friends. Zero advertisements, zero third-party OTPs, zero bloated enterprise queues (no Redis, Kafka, or BullMQ), and built as a clean modular monolith.

---

## 🌟 Key Highlights

- **Mobile-First UX**: Specifically engineered for phone viewports (375px–430px) with bottom navigation, thumb-friendly targets, and clean consumer styling.
- **Financial Exactness**: All monetary values are strictly tracked in integer minor units (paise/cents) to eliminate IEEE 754 floating-point errors.
- **Supported Splits**:
  - **Equal Split**: Automatically and deterministically distributes fractional remainder cents.
  - **Exact Split**: User specifies exact rupee/paise liability per member; validates strict equality to total amount.
  - **Percentage Split**: Exact percent share per member (must total 100%) with automated penny roundoff compensation.
- **Derived Balances (No Stored Balance Fallacy)**: Balances and liabilities are strictly derived from transactions (`Expense` + `ExpenseSplit` + `paidBy`).
- **Deterministic Settlement Engine**: Min-cash-flow algorithm simplifies debts into the minimal number of direct transfers.
- **Telegram Deep-Link Connection**: Link Telegram with zero OTPs using official `/start <token>` deep links.
- **Asynchronous Alerts**: Instant expense notifications dispatch asynchronously after database transaction commits—bot network issues never roll back financial records.
- **Idempotent Monthly Summary**: In-process cron job with database idempotency locks sends each friend their personal monthly net settlement summary.
- **Production-Grade Security**: Argon2id password hashing, HTTP-only SameSite cookies, brute-force rate limiters, and server-side authorization on all group endpoints.

---

## 🏗️ Monorepo Architecture

```text
splitwise/
│
├── apps/
│   ├── web/               # Next.js (App Router, Tailwind CSS, TanStack Query, React Hook Form)
│   └── api/               # Express.js REST API (TypeScript, Argon2, JWT cookies, node-cron)
│
├── packages/
│   ├── database/          # Prisma schema, migrations, client singleton, and realistic seed data
│   ├── types/             # Shared TypeScript types & API response envelopes
│   └── validation/        # Shared Zod validation schemas
│
├── docs/
│   ├── architecture.md    # System design & component interaction
│   ├── database.md        # Data dictionary, ER diagram & integer minor units
│   ├── security.md        # Security threat modeling, Argon2id & rate limits
│   ├── api.md             # REST API routes, payloads & authorization
│   ├── authentication.md  # Registration, session cookies & email reset flow
│   └── telegram.md        # Telegram bot deep link & notification architecture
│
├── docker-compose.yml     # Local PostgreSQL database
├── package.json           # Workspace scripts
├── pnpm-workspace.yaml
├── .env.example           # Complete environment variable template
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20/v24)
- **pnpm**: v9+ (or `pnpm.cmd` on Windows)
- **PostgreSQL**: Local PostgreSQL 16+ or Docker Compose

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` matches your local or remote PostgreSQL instance:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/splitwise_db?schema=public"
SESSION_SECRET="super-secure-random-session-secret-min-32-chars-long"
```

### 3. Start Database (Docker Compose)
If using Docker:
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
pnpm install
```

### 5. Generate Prisma Client & Migrate Schema
```bash
pnpm db:push
# or
pnpm db:migrate
```

### 6. Seed Realistic Data
Populates the database with 3 sample users (Neel, Rahul, Aman), an active group ("Mumbai Friends"), and sample expenses:
```bash
pnpm db:seed
```
> **Default Seed Credentials**:
> - Email: `neel@example.com` / `rahul@example.com` / `aman@example.com`
> - Password: `Password@123`

### 7. Run the Application
In two separate terminals (or with `pnpm dev:all`):

**Backend API (Port 4000):**
```bash
pnpm dev:api
```

**Frontend Client (Port 3000):**
```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser (or use mobile device preview).

---

## 🧪 Running Unit & Integration Tests

Execute the comprehensive financial test suite covering equal/exact/percentage splits, rounding remainder cents, and min-cash-flow debt simplification:
```bash
pnpm test
```

---

## 🤖 Telegram Bot Configuration

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, name your bot (e.g. `MySplitwiseBot`), and receive your Bot Token.
3. Add the token to `.env`:
   ```env
   TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
   TELEGRAM_BOT_USERNAME="MySplitwiseBot"
   TELEGRAM_WEBHOOK_SECRET="super-secret-telegram-webhook-token"
   ```
4. Set the Telegram Webhook (or run ngrok in local dev):
   ```bash
   curl -F "url=https://your-domain.com/api/telegram/webhook" \
        -F "secret_token=super-secret-telegram-webhook-token" \
        https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```
5. Navigate to **Me / Settings** in the app and tap **Connect Telegram Account**!

---

## 📊 Monthly Settlement Cron

A scheduled job runs on the 1st of every month (`0 0 1 * *`) in the configured timezone (`Asia/Kolkata`).
- Summarizes group expenses for the preceding month.
- Derives each member's contributions, shares, and settlements.
- Sends personalized formatted reports to connected Telegram users.
- Protected by `MonthlySummaryLog` for strict idempotency (safe against restarts or duplicate triggers).

---

## 🚢 Production Deployment

- **Database (Recommended: Supabase PostgreSQL)**:
  1. Create a free project at [Supabase](https://supabase.com).
  2. Copy the Connection String from **Project Settings → Database → Connection Pooling** (port 6543 with `?pgbouncer=true`).
  3. Deploy the schema:
     ```bash
     DATABASE_URL="your-supabase-url" pnpm db:push
     ```
- **Backend API**:
  Deploy `apps/api` to [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io) with start command `node dist/server.js`.
- **Frontend Web App**:
  Deploy `apps/web` to [Vercel](https://vercel.com) with root directory set to `apps/web`.

