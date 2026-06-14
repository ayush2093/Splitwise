# AI Context: Splitwise Clone

This file contains the complete working context, implementation decisions, tech stack, database schema, API design, and progress tracker for building the Splitwise Clone. It acts as the single source of truth for the project.

---

## 1. Product Understanding & Scope

### Core Flow
1. **User Sign Up & Login**: Secure email/password login.
2. **Group Management**:
   - Create groups.
   - Add/invite existing users via email search.
   - Remove users from groups (historical data preserved).
3. **Expense Management**:
   - Add group expenses.
   - Supported split types: Equal, Unequal, Percentage, and Share.
   - Single payer per expense.
   - Rounding leftover cents assigned to the first participant.
4. **Expense Chat**:
   - Real-time chat inside the Expense Detail page powered by WebSockets (Socket.io).
5. **Balances**:
   - Group-wise balances (who owes whom within a group).
   - Individual balance summary (net total across all groups).
6. **Debt Settlement**:
   - Settle up by recording payments that reduce the debt between two users.

### Out of Scope
- Recurring expenses
- Multiple currencies (USD only)
- Receipt uploading
- Notifications (email/push)
- Activity log/feed
- Search filters (except email search for adding members)
- Friend requests outside of groups

---

## 2. Technical Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React (Vite), HTML5, Vanilla CSS | Fast development, modular components, premium styling |
| **Backend** | Node.js, Express | Easy integration with Socket.io, rapid REST API building |
| **Database** | PostgreSQL | Relational DB required; structured schema for splits |
| **Real-time** | Socket.io | Bi-directional communication for expense chat |
| **Auth** | JWT (JSON Web Tokens) | Stateless, secure authentication stored in LocalStorage |

---

## 3. Database Schema

```mermaid
erDiagram
    USERS {
        int id PK
        string email UNIQUE
        string password_hash
        string name
        timestamp created_at
    }

    GROUPS {
        int id PK
        string name
        int created_by FK
        timestamp created_at
    }

    GROUP_MEMBERS {
        int group_id PK, FK
        int user_id PK, FK
        boolean is_active
        timestamp joined_at
    }

    EXPENSES {
        int id PK
        int group_id FK
        string description
        numeric amount
        timestamp date
        int paid_by FK
        string split_type
        int created_by FK
        timestamp created_at
    }

    EXPENSE_SPLITS {
        int id PK
        int expense_id FK
        int user_id FK
        numeric amount
        numeric percentage
        numeric share
    }

    PAYMENTS {
        int id PK
        int group_id FK
        int from_user_id FK
        int to_user_id FK
        numeric amount
        timestamp date
        timestamp created_at
    }

    CHAT_MESSAGES {
        int id PK
        int expense_id FK
        int user_id FK
        text message
        timestamp created_at
    }

    USERS ||--o{ GROUPS : "created by"
    USERS ||--o{ GROUP_MEMBERS : "member of"
    GROUPS ||--o{ GROUP_MEMBERS : "has members"
    GROUPS ||--o{ EXPENSES : "contains"
    USERS ||--o{ EXPENSES : "paid by"
    EXPENSES ||--o{ EXPENSE_SPLITS : "splits into"
    USERS ||--o{ EXPENSE_SPLITS : "owes"
    GROUPS ||--o{ PAYMENTS : "contains"
    USERS ||--o{ PAYMENTS : "pays"
    USERS ||--o{ PAYMENTS : "receives"
    EXPENSES ||--o{ CHAT_MESSAGES : "has comments"
    USERS ||--o{ CHAT_MESSAGES : "posted by"
```

### Table Details
1. **`users`**: Stores credentials and profiles.
2. **`groups`**: Store group metadata.
3. **`group_members`**: Join table. If a user is removed, `is_active` becomes `false` so historical expenses and split records remain intact.
4. **`expenses`**: Tracks total amount, payer, and category metadata.
5. **`expense_splits`**: Tracks exactly how much each user owes for a specific expense.
6. **`payments`**: Records settlements. Acts as a debt reducer.
7. **`chat_messages`**: Real-time comments on a specific expense.

---

## 4. API Design

### Authentication
- `POST /api/auth/register` (name, email, password)
- `POST /api/auth/login` (email, password) -> Returns JWT token
- `GET /api/auth/me` -> Verify JWT, returns current user object

### Groups
- `GET /api/groups` -> List groups current user belongs to (active membership)
- `POST /api/groups` -> Create a new group (creates group & adds creator as member)
- `GET /api/groups/:id` -> Detailed view of group, including:
  - Group metadata
  - Active members
  - List of expenses
  - List of settlements
  - Group-wise balances (calculated dynamically)
- `POST /api/groups/:id/members` -> Add member to group (lookup by email)
- `DELETE /api/groups/:id/members/:userId` -> Remove member (sets `is_active = false`)

### Expenses
- `POST /api/groups/:groupId/expenses` -> Add an expense.
  - Inputs: `description`, `amount`, `date`, `paid_by`, `split_type`, `splits` (array of `{ user_id, share/percentage/amount }`)
  - Server calculates actual split amounts and writes to `expense_splits`
- `GET /api/expenses/:expenseId` -> Detailed split details and chat history
- `POST /api/expenses/:expenseId/messages` -> Backup endpoint to post chat (though WebSockets is primary)

### Settlements
- `POST /api/groups/:groupId/settlements` -> Record a payment
  - Inputs: `from_user_id` (payer), `to_user_id` (payee), `amount`, `date`

### Users
- `GET /api/users/search?email=...` -> Find user by email for adding to group

### Demo Seeding
- `POST /api/dashboard/seed` -> Seed mock data (1 group, 3 mock members, 4 expenses, 1 payment, chat history) to prevent empty dashboards.

---

## 5. Balance Calculation Engine

For any user `U` in group `G`:
1. **Paid Amount**: Sum of `amount` in `expenses` where `paid_by = U` and `group_id = G`.
2. **Owed Amount**: Sum of `amount` in `expense_splits` where `user_id = U` and expense belongs to group `G`.
3. **Settled Paid**: Sum of `amount` in `payments` where `from_user_id = U` and `group_id = G`.
4. **Settled Received**: Sum of `amount` in `payments` where `to_user_id = U` and `group_id = G`.
5. **Net Balance**: `(Paid Amount + Settled Paid) - (Owed Amount + Settled Received)`

### Pairwise Debts Calculation
To compute who owes whom within group `G`:
- For each active member pair `(A, B)`:
  - Determine amount `A` owes `B` directly:
    - Sum of A's splits where B paid: `Sum(expense_splits.amount where split.user_id = A and expense.paid_by = B)`.
    - Minus payments from A to B: `Sum(payments.amount where from = A and to = B)`.
  - Let this be `Debt(A -> B)`.
  - Calculate `NetDebt(A -> B) = Debt(A -> B) - Debt(B -> A)`.
  - If `NetDebt(A -> B) > 0`, A owes B `NetDebt(A -> B)`.
  - If `NetDebt(A -> B) < 0`, B owes A `abs(NetDebt(A -> B))`.

---

## 6. Frontend Structure

A single-page application (SPA) layout with the following pages/views:
- `/`: Landing page (replica of the official Splitwise homepage) for guest users; Dashboard for authenticated users.
- `/login` & `/signup`: Styled credentials screens.
- `/group/:id`:
  - Main Panel: Expense list + "+ Add Expense" & "Settle Up" buttons.
  - Sidebar: Active Group members, group balance summary (who owes who).
- `/expense/:id`: Detailed view of splits, chat feed, and text box to send new messages in real-time.

---

## 7. Implementation & Deployment Plan

- **Backend**: Render web service.
- **Frontend**: Vercel (using `vercel.json` rewrite file to support client-side routing).
- **Database**: Supabase / Neon (Managed PostgreSQL).
- **Phases**:
  1. Setup Express backend with JWT auth and SQLite/PG connection.
  2. Setup React frontend with simple route structure and authentication hooks.
  3. Implement Group creation, member addition, and member removal.
  4. Implement Expense splits logic (validation, rounding, DB insertion) and tests.
  5. Implement Balance and Debt calculations on backend and show on frontend.
  6. Implement Socket.io integration for chat and real-time page updates.
  7. Deploy database, backend, and frontend.

---

## 8. Prompts & Responses
- **Initial Prompt**: Pasted the internship assignment prompt to act as a junior developer, scope a realistic 3-day MVP version of Splitwise, interview the user, and write this `AI_CONTEXT.md` file.
- **Scoping Interview Responses**: User responded with:
  - PostgreSQL database.
  - Express backend, React frontend, Socket.io real-time chat, JWT auth.
  - Settle Up records as Payments transaction.
  - Direct debt tracking (no simplification).
  - Soft removal for members (preserve data).
  - Cent-based math rounding leftovers to first participant.
  - Render for backend and Vercel for frontend.

## 9. Changes Made During Implementation
- **Vite React SPA Scaffolding**: Initialized React frontend using Vite in JavaScript (`--template react` in non-interactive mode).
- **Auto-Initialization of Database Tables**: Configured the backend's `db.js` to automatically read `schema.sql` on startup and verify/initialize PostgreSQL tables, minimizing cloud deployment config.
- **Dynamic Combined Dashboard**: Implemented `GET /api/dashboard` which queries all memberships and dynamically calculates net balances and aggregates pairwise outstanding debts across all active groups.

## 10. Known Limitations
- **No Email/SMS invitations**: Members must have registered accounts on the database before they can be added to any group via email search.
- **No edits on settled expenses**: Once an expense or settlement is created, it cannot be modified or deleted in this MVP version.

