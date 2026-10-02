# Database Architecture & Schema Design

## 1. Monetary Storage Strategy

Financial accuracy is non-negotiable. To eliminate binary floating-point roundoff errors (e.g., `0.1 + 0.2 = 0.30000000000000004`):

> **All monetary values are stored as integers representing minor currency units (e.g., Paise in INR or Cents in USD).**

- `120000` corresponds to `₹1,200.00`
- `3333` corresponds to `₹33.33`
- Database column type: `BigInt` or `Int` (PostgreSQL `INTEGER` or `BIGINT`).
- Zero fractional loss during division, addition, and settlement simplifications.

---

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ GroupMember : "belongs to"
    User ||--o{ Expense : "paid by / created by"
    User ||--o{ ExpenseSplit : "owes share in"
    User ||--o{ PasswordReset : "requests"
    User ||--o{ TelegramConnectToken : "generates"

    Group ||--o{ GroupMember : "has members"
    Group ||--o{ Expense : "records expenses"
    Group ||--o{ MonthlySummaryLog : "records summaries"

    Expense ||--o{ ExpenseSplit : "divided into"

    User {
        string id PK
        string email UK
        string name
        string passwordHash
        string telegramChatId UK
        string telegramUsername
        boolean telegramConnected
        datetime createdAt
        datetime updatedAt
    }

    PasswordReset {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
        datetime createdAt
    }

    TelegramConnectToken {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime createdAt
    }

    Group {
        string id PK
        string name
        string createdBy FK
        datetime createdAt
        datetime updatedAt
    }

    GroupMember {
        string id PK
        string groupId FK
        string userId FK
        datetime joinedAt
    }

    Expense {
        string id PK
        string groupId FK
        string description
        int totalAmount
        string splitType
        string paidBy FK
        string createdBy FK
        datetime expenseDate
        datetime createdAt
        datetime updatedAt
    }

    ExpenseSplit {
        string id PK
        string expenseId FK
        string userId FK
        int amountOwed
    }

    MonthlySummaryLog {
        string id PK
        string groupId FK
        string yearMonth
        datetime executedAt
    }
```

---

## 3. Data Dictionary

### `User`
Stores authenticated users in the private group application.
- `id` (UUID / cuid): Primary key
- `email` (VARCHAR 255): Unique, normalized lowercase email
- `name` (VARCHAR 100): Display name
- `passwordHash` (TEXT): Argon2id secure password hash
- `telegramChatId` (VARCHAR 64, Nullable): Unique Telegram Chat ID (deep-linked)
- `telegramUsername` (VARCHAR 64, Nullable): Display handle for notifications
- `telegramConnected` (BOOLEAN): Flag indicating active Telegram alerts
- `createdAt`, `updatedAt` (TIMESTAMPTZ)

### `PasswordReset`
Handles single-use, cryptographically secure password reset tokens.
- `id` (UUID / cuid): Primary key
- `userId` (FK -> User.id): Target user
- `tokenHash` (VARCHAR 64): SHA-256 hash of the 32-byte hex token sent via email (never stores plain token)
- `expiresAt` (TIMESTAMPTZ): Lifetime (typically 1 hour)
- `usedAt` (TIMESTAMPTZ, Nullable): Set on reset execution; prevents replay attacks

### `TelegramConnectToken`
Short-lived temporary connection tokens for deep linking into `/start <token>`.
- `id` (UUID / cuid): Primary key
- `userId` (FK -> User.id): Target user requesting connection
- `tokenHash` (VARCHAR 64): SHA-256 hash of the random hex token
- `expiresAt` (TIMESTAMPTZ): 15-minute validity window

### `Group`
Represents an expense-sharing circle (e.g. "Flatmates", "Goa Trip").
- `id` (UUID / cuid): Primary key
- `name` (VARCHAR 100): Group title
- `createdBy` (FK -> User.id): Creator
- `createdAt`, `updatedAt` (TIMESTAMPTZ)

### `GroupMember`
Join table establishing many-to-many relationship between Users and Groups.
- `id` (UUID / cuid): Primary key
- `groupId` (FK -> Group.id, CASCADE)
- `userId` (FK -> User.id, CASCADE)
- `joinedAt` (TIMESTAMPTZ)
- **Constraint**: `UNIQUE(groupId, userId)`

### `Expense`
Stores the overarching expense transaction.
- `id` (UUID / cuid): Primary key
- `groupId` (FK -> Group.id, CASCADE)
- `description` (VARCHAR 255): Expense purpose (e.g. "Dinner", "Cab")
- `totalAmount` (INTEGER): Total amount in minor units (paise/cents)
- `splitType` (VARCHAR 20): `EQUAL`, `EXACT`, or `PERCENTAGE`
- `paidBy` (FK -> User.id): Member who paid the bill
- `createdBy` (FK -> User.id): Member who entered the record
- `expenseDate` (TIMESTAMPTZ): Date the expenditure occurred
- `createdAt`, `updatedAt` (TIMESTAMPTZ)

### `ExpenseSplit`
Itemizes the exact liability for each participant in an expense.
- `id` (UUID / cuid): Primary key
- `expenseId` (FK -> Expense.id, CASCADE)
- `userId` (FK -> User.id, CASCADE)
- `amountOwed` (INTEGER): Liability of this member in minor units
- **Constraint**: `UNIQUE(expenseId, userId)`

### `MonthlySummaryLog`
Ensures idempotency for scheduled monthly summary cron jobs.
- `id` (UUID / cuid): Primary key
- `groupId` (FK -> Group.id, CASCADE)
- `yearMonth` (VARCHAR 7): Format `YYYY-MM` (e.g. "2026-10")
- `executedAt` (TIMESTAMPTZ)
- **Constraint**: `UNIQUE(groupId, yearMonth)`

---

## 4. Database Indexes

To guarantee optimal query performance without redundant overhead:

| Table | Index Columns | Reason |
|---|---|---|
| `User` | `email` (Unique) | Fast authentication lookup |
| `User` | `telegramChatId` (Unique sparse) | Fast webhook event routing |
| `GroupMember` | `groupId`, `userId` (Unique) | Group membership verification & user group lists |
| `GroupMember` | `userId` | Quickly listing all groups for a user |
| `Expense` | `groupId`, `expenseDate DESC` | Paginated group expense feed |
| `Expense` | `paidBy` | Calculating total user contributions |
| `ExpenseSplit` | `expenseId` | Cascade fetching expense shares |
| `ExpenseSplit` | `userId` | Calculating total user liabilities |
| `PasswordReset` | `tokenHash` (Unique) | Fast token validation lookup |
| `MonthlySummaryLog` | `groupId`, `yearMonth` (Unique) | Fast idempotency lock check |

---

## 5. Transaction Safety Rules

1. **Atomic Expense Mutation**:
   Every expense addition, modification, or deletion must execute inside a PostgreSQL transaction:
   ```ts
   await prisma.$transaction(async (tx) => {
     // 1. Verify payer and split participants are active group members
     // 2. Validate sum(amountOwed) === totalAmount
     // 3. Create Expense
     // 4. CreateMany ExpenseSplit
   });
   ```
## 6. Supabase Production PostgreSQL Configuration

Supabase is the recommended managed PostgreSQL provider for this project in production:

### Connection String Format
Supabase provides two connection URLs (found in **Project Settings -> Database**):
1. **Transaction Pooler (Port 6543 - Recommended for Serverless / Next.js / Express)**:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   ```
2. **Direct Connection (Port 5432 - Used for Prisma Migrations & Schema Push)**:
   ```env
   DIRECT_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
   ```

### Running Migrations on Supabase
To deploy schema to your Supabase instance:
```bash
# Set your DATABASE_URL in .env
pnpm db:push
# Seed initial users & groups
pnpm db:seed
```
