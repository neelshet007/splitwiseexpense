# REST API Specification

All endpoints return JSON and adhere to a unified response envelope:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human friendly error message",
    "details": []
  }
}
```

---

## 1. Authentication Endpoints (`/api/auth`)

| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | Public (Rate limited) |
| `POST` | `/api/auth/login` | Authenticate & set HTTP-only cookie | Public (Rate limited) |
| `POST` | `/api/auth/logout` | Clear session cookie | Public |
| `POST` | `/api/auth/forgot-password`| Request password reset email | Public (Rate limited) |
| `POST` | `/api/auth/reset-password` | Submit new password with token | Public |
| `GET`  | `/api/auth/me` | Fetch authenticated user profile | Private |

---

## 2. Groups Endpoints (`/api/groups`)

| Method | Path | Description | Access |
|---|---|---|---|
| `GET`  | `/api/groups` | List user's active groups | Private |
| `POST` | `/api/groups` | Create a new group | Private |
| `GET`  | `/api/groups/:groupId` | Get group details and members | Group Member |
| `POST` | `/api/groups/:groupId/members` | Add member to group by email | Group Member |
| `DELETE` | `/api/groups/:groupId/members/:userId` | Remove member from group | Group Member |

---

## 3. Expenses Endpoints (`/api/groups/:groupId/expenses`)

| Method | Path | Description | Access |
|---|---|---|---|
| `GET`  | `/api/groups/:groupId/expenses` | Paginated expense history for group | Group Member |
| `POST` | `/api/groups/:groupId/expenses` | Create an expense (Equal, Exact, %) | Group Member |
| `GET`  | `/api/expenses/:expenseId` | Get single expense details & splits | Group Member |
| `PATCH`| `/api/expenses/:expenseId` | Update an existing expense | Payer / Creator |
| `DELETE` | `/api/expenses/:expenseId` | Delete an expense | Payer / Creator |

---

## 4. Balances & Settlements (`/api/groups/:groupId`)

| Method | Path | Description | Access |
|---|---|---|---|
| `GET`  | `/api/groups/:groupId/balances` | Summary of paid, share, and net balances | Group Member |
| `GET`  | `/api/groups/:groupId/settlements`| Simplified "who owes whom" list | Group Member |
| `GET`  | `/api/dashboard/summary` | Global summary for current user across groups | Private |

---

## 5. Telegram Integration (`/api/telegram`)

| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/api/telegram/connect` | Generate temporary deep-link token | Private |
| `GET`  | `/api/telegram/status` | Current Telegram connection status | Private |
| `DELETE`| `/api/telegram/disconnect` | Disconnect Telegram account | Private |
| `POST` | `/api/telegram/webhook` | Telegram Bot API Webhook receiver | Webhook Secret |
