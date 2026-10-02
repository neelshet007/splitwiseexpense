# System Architecture

## Overview

The Expense Splitting Application is a private, production-ready, mobile-first financial utility designed for a circle of 10–20 friends. It eliminates advertisements, complex enterprise queues (no Redis, Kafka, or BullMQ), and unnecessary microservices in favor of a clean, reliable **modular monolith**.

```
┌─────────────────────────────────────────────────────────────┐
│                 Mobile-First Client (Next.js)               │
│         Tailwind CSS / shadcn/ui / React Hook Form          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTPS / JSON / Cookies
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Monolith API (Node / TS)            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Middlewares: Auth (Argon2 / Cookie), Rate Limit, CORS │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Modules:                                              │  │
│  │  - Auth (Register, Login, Password Reset via Email)   │  │
│  │  - Users (Profile, Preferences)                       │  │
│  │  - Groups (Membership & Strict Authorization)         │  │
│  │  - Expenses (Equal, Exact, Percentage Splits)         │  │
│  │  - Balances & Settlement Engine (Deterministic)       │  │
│  │  - Telegram (Deep-link Auth & Instant Expense Alerts) │  │
│  │  - Monthly Summary (Idempotent in-process Cron)       │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
   ┌─────────────────────────┐   ┌───────────────────────────┐
   │       PostgreSQL        │   │    Telegram Bot API       │
   │      (Prisma ORM)       │   │ (Deep link / Async Alert) │
   └─────────────────────────┘   └───────────────────────────┘
```

---

## 1. Architectural Principles

1. **Modular Monolith**: All backend domain logic lives in a single Express codebase structured cleanly by domain module (`auth`, `users`, `groups`, `expenses`, `balances`, `telegram`, `monthly-summary`).
2. **Transaction Integrity**: Financial mutations (expenses, splits) execute inside strict PostgreSQL transactions (`prisma.$transaction`).
3. **Derived Balances (No Stored Balance Fallacy)**: Balances are strictly computed on-demand from immutable financial transactions (`Expense`, `ExpenseSplit`, `paidBy`). There are no cached running balance columns that can drift out of sync.
4. **Resilient Decoupling**: External integrations (Telegram notifications, SMTP password reset) are executed asynchronously post-commit. A failure in Telegram or SMTP never rolls back financial transactions.
5. **Zero Heavy Infrastructure**: Runs on standard Node.js + PostgreSQL. Background tasks (e.g. monthly settlement summary) utilize standard in-process scheduling (`node-cron`) with database idempotency locks.

---

## 2. Monorepo Organization

The project uses a pnpm workspace monorepo:

```text
expense-app/
│
├── apps/
│   ├── web/               # Next.js App Router, Tailwind CSS, shadcn/ui
│   └── api/               # Express.js REST API with TypeScript
│
├── packages/
│   ├── database/          # Prisma schema, client, migrations & seeders
│   ├── types/             # Shared TypeScript DTOs and entity models
│   └── validation/        # Shared Zod schemas (client + server validation)
│
├── docs/                  # System documentation
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── authentication.md
│   ├── telegram.md
│   └── security.md
│
├── docker-compose.yml     # Local PostgreSQL service
├── package.json           # Root workspace scripts
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | Next.js (App Router, TS) | Fast client rendering, seamless mobile viewport support |
| **Styling** | Tailwind CSS + Lucide Icons | Clean mobile design system without heavy component bloat |
| **Forms & Validation** | React Hook Form + Zod | Type-safe form validation shared directly with backend |
| **Data Fetching** | TanStack Query + Fetch | Optimistic UI updates, caching, and auto-refetching |
| **Backend API** | Express.js + TypeScript | Lightweight, fast startup, zero magical framework lock-in |
| **ORM & DB Access** | Prisma ORM | Strong type safety, auto-generated migrations, connection pooling |
| **Database** | PostgreSQL 16+ | ACID transactions, strict constraints, decimal/integer minor units |
| **Auth & Security** | Argon2id + HTTP-only cookies | Robust against brute-force and side-channel attacks |
| **Messaging** | Telegram Bot API | Direct real-time alerts without third-party SMS/OTP gateways |
| **Scheduling** | node-cron + DB locks | Simple, predictable cron execution without Redis/BullMQ |

---

## 4. Financial Calculation Engine

### Minor Units Representation
All monetary amounts are treated as **integers in minor units (paise/cents)** across the database, business logic, and API payloads.
- `120000` = ₹1,200.00
- Eliminates IEEE 754 floating-point inaccuracies (`0.1 + 0.2 !== 0.3`).

### Split Types
1. **Equal Split**: Even division among selected members. Any fractional remainder (e.g. 100 divided 3 ways = 33, 33, 34) is deterministically allocated to the payer or first member.
2. **Exact Split**: Each participant's share is explicitly defined. The sum of all shares must strictly equal `totalAmountMinor`.
3. **Percentage Split**: Each participant is assigned a basis percentage (must total 100%). Minor unit amounts are calculated using rounding, and rounding residual cents are adjusted to ensure the exact total is preserved.

### Settlement Engine (Min Cash Flow)
Computes net balance per user:
$$\text{Net Balance}_i = \sum \text{Paid}_i - \sum \text{Share}_i$$
A deterministic greedy algorithm pairs the largest debtor with the largest creditor iteratively, generating the minimum number of bank transfers needed to settle all debts.

---

## 5. Deployment Architecture

- **Frontend**: Vercel or Node.js container.
- **Backend**: Render, Railway, or Fly.io running single container Node.js.
- **Database**: Neon, Supabase, or Railway Managed PostgreSQL.
- **Local Development**: Docker Compose for PostgreSQL + local dev servers via `pnpm dev`.
