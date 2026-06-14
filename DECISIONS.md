# DECISIONS.md — Architecture & Design Decisions

This document outlines the major architectural and product design decisions made while building the Shared Expenses Application.

---

## 1. Debt Minimization Engine (Aisha's Request)
* **Goal**: Minimize the number of transactional transfers required to settle all debts in the group.
* **Options Considered**:
  1. **Direct Pairwise Splits**: Keep all debts exactly as incurred (e.g. if A owes B, and B owes C, make A pay B, and B pay C).
     * *Pros*: 100% trace accuracy.
     * *Cons*: Aisha has to make multiple manual transfers.
  2. **Min-Cost Flow Optimization**: Model balances as a network flow problem.
     * *Pros*: Mathematically guarantees minimal total money moved.
     * *Cons*: Highly complex to write, maintain, and verify.
  3. **Greedy Balance Matching Heuristic (Chosen)**:
     * *How it works*: Sum the net balance of every group member (Total Spent + Received - Total Owed - Settled Out). Sort them into two lists: debtors (balance < 0) and creditors (balance > 0). Continually match the largest debtor with the largest creditor, reducing their respective balances until all debts are resolved.
     * *Why Chosen*: It guarantees that the number of payments is at most $N-1$ (where $N$ is the number of members), requires only simple sorting, and perfectly satisfies Aisha's request ("Who pays whom, how much, done").

---

## 2. Dual-Mode Ledgers & balances (Rohan's vs Aisha's Requests)
* **Goal**: Satisfy both Aisha (who wants simple summary numbers) and Rohan (who wants an itemized audit trail explaining why he owes that specific balance).
* **Decision**: Co-exist both calculation methodologies.
  * **Direct Ledger Mode (For Rohan)**: Query and display every direct transaction where a user owes another (splits + direct payments). This compiles a chronological ledger of actual events.
  * **Minimized Cash Flow Mode (For Aisha)**: Use the Greedy Minimizer on the net aggregate balances to display the optimized payout list on the group page.
  * **Result**: Rohan can click on his balance, open the itemized ledger modal, and see every raw swiggy order, rent payment, and refund that sums up to his net balance. At the same time, Aisha is shown the 3-step simplified payments plan to settle up.

---

## 3. Dynamic chronological Timeline Splits (Sam's Request)
* **Goal**: Support group membership changes over time, ensuring users are only split into expenses occurred while they were active group members.
* **Decision**: Add membership timeline fields (`joined_at` and `left_at`) to the `group_members` relation.
  * **Handling**: When creating or importing an expense, the system automatically checks if the expense `date` lies within each participant's active bounds: `joined_at <= expense_date` and `(left_at IS NULL OR left_at >= expense_date)`.
  * **Resolution for Sam**: Sam moved in mid-April. March utility bills are dated before Sam's `joined_at` bound, so he is automatically excluded from the split list, and the cost is divided only among the active roommates (Aisha, Rohan, Priya, Meera).
  * **Resolution for Meera**: Meera left on March 31. April rent is split without Meera. For Row 36 (dated April 2, containing Meera), the wizard flags it as a timeline violation and removes Meera from the split before saving.

---

## 4. Multi-Currency Tracking & Storage (Priya's Request)
* **Goal**: Handle expenses logged in US Dollars (USD) and convert them to Indian Rupees (INR).
* **Options Considered**:
  1. **Destructive Conversion**: Convert the amount immediately to INR at parsing time and lose the original USD value.
  2. **Multi-Currency Schema (Chosen)**: Store BOTH `amount` (normalized in INR) and `amount_usd` (original USD amount), along with the `currency` string.
  * **Why Chosen**: Satisfies Priya's request for accuracy and allows Rohan to inspect the ledger and see: *Goa villa booking: ₹44,820.00 (Original: $540.00 USD)*. The exchange rate is fixed at ₹83.0/USD based on current flatmate agreement.

---

## 5. Wizard-Based Cooperative Data Ingestion (Meera's Request)
* **Goal**: Handle the 20+ spreadsheet anomalies securely without silently guessing or crashing the application.
* **Decision**: Implement a multi-step CSV Ingestion Wizard on the frontend, working in tandem with a dry-run analysis endpoint on the backend.
  * **Why Chosen**: Meera requested approval for any duplicate deletions/changes. By running a backend dry-run analyzer `/api/import/analyze`, the app detects all 12+ anomaly classes and returns them to the React frontend. The step-by-step wizard displays these anomalies explicitly to the user, allowing them to confirm casing fixes, toggle dates, approve duplicate skips, and then submit the finalized list to the database via `/api/import/finalize` in a single transaction.
