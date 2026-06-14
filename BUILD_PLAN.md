# Build Plan: Splitwise Clone

This document details the product research, architecture, AI collaboration, and tradeoffs for the Splitwise Clone application.

---

## 1. Product Research & Reverse Engineering

### Product Study
Splitwise is a expense-sharing application that allows groups of people to track shared expenses and settle debts. Our analysis identified the following core behaviors:
1. **Balances are transactional**: A user's balance is not a single static field but is calculated dynamically from their participation in expenses and settlements.
2. **Groups group users**: Expenses can belong to a group. Within a group, we can calculate group-specific balances.
3. **Payer vs. Debtors**: For every expense, one person pays, and one or more people (including the payer) split the expense.
4. **Debts are directional**: If User A owes User B $10, and User B owes User A $5, the net debt is User A owing User B $5.

### Identified Workflows
- **Guest Landing Page**: High-fidelity landing page replica of the official Splitwise homepage using custom CSS phone mockup widgets to demonstrate UI layouts.
- **Onboarding**: User registration and login -> JWT token retrieval -> token stored locally.
- **Group Creation**: Create a group -> Add members via search -> creator can remove members.
- **Expense Log**: Payer pays an amount -> splits it (Equally, Unequally, Percentage, or Shares) -> rounded cent adjustment on first participant.
- **Settlement**: One member pays another -> recorded as a settlement payment -> reduces net debt.
- **Expense Chat**: Real-time room-scoped discussion for members to comment on a specific expense.

### Product Assumptions
- **Single Payer**: Expenses always have exactly one payer.
- **Group-Scoped Expenses**: All expenses are tied to a group (individual peer-to-peer expenses outside of groups are out of scope).
- **Direct Debts**: No complex debt simplification algorithms are run. Direct debts (A owes B, B owes C) are tracked and settled directly.

---

## 2. Technical Architecture

### Tech Stack
- **Frontend**: React (Vite, SPA), React Router, HTML5, Vanilla CSS, Socket.io-client.
- **Backend**: Node.js, Express, Socket.io.
- **Database**: PostgreSQL (Relational DB only).
- **Authentication**: JWT token authorization.

### Database Schema
We created a fully relational schema containing indexes for performance:
- `users`: stores profile and password hashes.
- `groups`: stores group details.
- `group_members`: join table with `is_active` flag (supports user removal without breaking historic splits).
- `expenses`: stores description, amount, payer, split type, and group ID.
- `expense_splits`: join table linking users to expenses with their split share and amount.
- `payments`: tracks settlements between group members.
- `chat_messages`: tracks real-time comments on specific expenses.

### API Design
- `POST /api/auth/register` & `POST /api/auth/login` -> Auth handling.
- `GET /api/auth/me` -> Fetches logged in user info.
- `GET /api/groups` & `POST /api/groups` -> List and create groups.
- `GET /api/groups/:id` -> Detailed group stats, active members, list of expenses, payments, balances, and pairwise debts.
- `POST /api/groups/:id/members` -> Add member by email search.
- `DELETE /api/groups/:id/members/:userId` -> Remove member (creator only).
- `POST /api/groups/:groupId/expenses` -> Log new expense (runs split engine).
- `GET /api/expenses/:id` -> Expense splits and message history.
- `POST /api/groups/:groupId/settlements` -> Record a payment to reduce debt.
- `GET /api/users/search?email=...` -> Look up registered user by email.
- `GET /api/dashboard` -> Consolidated totals and debt sheets across all groups.

### Frontend Structure
- Layout Shell: Navigation sidebar + content panel.
- Pages: Landing, Login, Signup, Dashboard, Group Detail, Expense Detail.
- WebSockets: Reuses the JWT token during connection handshake to securely authenticate WebSocket clients and join expense rooms.

### Deployment Approach
- **Frontend**: Deployed to Vercel (static React hosting).
- **Backend**: Deployed to Render (Node web service with WebSocket capability).
- **Database**: Supabase or Neon (managed cloud PostgreSQL).

---

## 3. AI Collaboration Process

### Interaction Summary
1. **Initial Scope Alignment**: The AI behaved as a junior engineer, asking detailed questions across product flows, database constraints, rounding logic, WebSocket design, and styling templates before writing any code.
2. **Answering & Detailing**: The user provided complete specifications (PostgreSQL, Socket.io, Vanilla CSS light theme, Render/Vercel deployment, etc.).
3. **Maintaining Context**: The AI immediately generated `AI_CONTEXT.md` to establish the single source of truth and created a detailed `implementation_plan.md` for approval.
4. **Execution and Validation**: Following approval, the AI tracked tasks using `task.md`, built the backend files first, validated calculations with Jest unit tests, scaffolded React, created the views, and tested compilation.

---

## 4. Tradeoffs & Simplifications

### Simplifications
- **No Debt Simplification**: We skipped the "Simplify Debts" algorithm in favor of direct pairwise debts (A owes B, B owes C) to maintain a realistic, bug-free implementation scope for a 2-day delivery window.
- **Removed Members**: Instead of deleting user memberships which would destroy transactional history, we implemented a soft-removal flag `is_active = false`. This removes them from dropdowns for *new* expenses while preserving their historical split records and outstanding balance history.
- **Cent-Based Math**: All calculations (like equal and percentage splits) are completed in integer cents on the backend to avoid floating-point inaccuracies.
- **Cent Leftovers**: Rounding errors are corrected by adding/subtracting the leftover cents to/from the first participant in the split list.

### Future Improvements
- **Activity Log**: An audit trail of who added/modified/deleted expenses and settlements.
- **Currency conversions**: Support for multiple currencies using live exchange rates.
- **Group deletion**: Archive entire groups once all net balances are settled to zero.
