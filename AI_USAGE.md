# AI_USAGE.md — AI Collaboration Log

This document lists the details of the AI collaboration, key prompts used, and three concrete case studies where the AI-generated code needed manual correction and debugging.

---

## 1. AI Tooling details
* **Primary AI Collaborator**: Antigravity (Advanced Agentic Coding agent developed by Google DeepMind).
* **Work Pattern**: Interactive Pair Programming. The AI acted as a junior engineer following design guidance, planning steps, running terminal-based build checks, and writing code under engineer supervision.

---

## 2. Key Prompts Used
1. **Scoping Prompt**: *"Analyze the Spreetail assignment sheet and reverse engineer its core product requirements. Ask me product and architectural questions to draft a database schema and implementation roadmap before writing code."*
2. **Backend Analysis Prompt**: *"Write a CSV parser and dry-run analyzer `/api/import/analyze` that identifies all 12+ anomalies in the spreadsheet, including duplicate rows, casing typos, date sequence format ambiguity, negative values, and timeline boundaries."*
3. **Debts Optimization Prompt**: *"Implement a greedy cash flow minimizer in JavaScript that matches largest debtors and creditors. Write Jest test suites to cover edge cases, circular debts, and perfect balance sheets."*

---

## 3. Concrete Case Studies of AI Corrections

### Case Study 1: Missing `STANDARD_MEMBERS` Definition in Wizard UI
* **What the AI did wrong**: The AI implemented a dropdown selector in `frontend/src/pages/ImportWizard.jsx` to let users resolve payer typos by selecting from standard flatmate names. However, it used the constant `STANDARD_MEMBERS` on line 261 without declaring it anywhere in the file, resulting in a runtime `ReferenceError` when opening the import page.
* **How it was caught**: During codebase-wide reference checking and verification, we searched for the definition of `STANDARD_MEMBERS` and found it was defined in the backend files but omitted in the frontend.
* **What was changed**: We defined the constant at the top of `ImportWizard.jsx`:
  ```javascript
  const STANDARD_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];
  ```

### Case Study 2: Route Registration Omission in `App.jsx`
* **What the AI did wrong**: The AI successfully created the pages `ImportWizard.jsx` and `ImportReports.jsx` and updated the `Sidebar.jsx` links. However, it forgot to register the corresponding route elements in `frontend/src/App.jsx`. As a result, clicking the CSV Import or Import Reports links led to a blank dashboard (triggering the wildcard 404 path redirection).
* **How it was caught**: Inspected the React Router switch blocks in `App.jsx` and identified that the paths `/import` and `/reports` were missing.
* **What was changed**: Imported the page components and added the appropriate logged-in routes inside the Vite shell configuration:
  ```javascript
  import ImportWizard from './pages/ImportWizard';
  import ImportReports from './pages/ImportReports';
  // ...
  <Route path="/import" element={<ImportWizard onImportSuccess={triggerSidebarRefresh} />} />
  <Route path="/reports" element={<ImportReports />} />
  <Route path="/reports/:id" element={<ImportReports />} />
  ```

### Case Study 3: Strict Non-Negative Database Constraints on Refunds
* **What the AI did wrong**: In the initial draft of the database schema (`backend/schema.sql`), the AI added a check constraint to prevent negative value entries in the `expenses` and `expense_splits` tables to prevent corrupted input. However, this broke ingestion for Row 26 in the spreadsheet, which records a negative value (`-30` USD) representing a parasailing cancellation refund.
* **How it was caught**: Analyzed the CSV contents and realized that refunds require negative splits to credit the roommates back. Under the original constraints, the database transaction would fail and roll back.
* **What was changed**: Modified the PostgreSQL schema and migrations to remove negative-value checks from `expenses` and `expense_splits` tables (allowing negative balances for refunds), but kept strict positive check constraints on the `payments` table (since settlements should only represent positive transfers of money).
