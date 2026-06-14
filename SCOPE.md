# SCOPE.md — Anomaly Log & Database Schema

This document details the data normalization scope, anomaly detection logs, and the database schema design implemented for the shared expenses application.

---

## 1. CSV Data Anomaly Log & Resolution Policies

The `expenses_export.csv` file contains **20+ distinct data problems**. Our automated importer detects all of these issues and resolves them through user-confirmed policies in the import wizard.

| Row(s) | Description | Anomaly Detected | Classification / Type | Resolution & Handling Policy |
| :--- | :--- | :--- | :--- | :--- |
| **5 & 6** | Dinner at Marina Bites / dinner - marina bites | Duplicate entries logged by the same user on the same date with identical amounts. | `DUPLICATE_ENTRY` | **Policy**: Keep Row 5 (which contains description details and notes) and skip Row 6 (duplicate). |
| **7** | Electricity Feb | Amount is formatted with quotes and a comma: `"1,200"`. | `COMMA_FORMATTED_AMOUNT` | **Policy**: Clean formatting, strip quotes, remove commas, and parse as numeric `1200.00`. |
| **9** | Movie night snacks | Payer name `priya` is in lowercase instead of standard capitalized `Priya`. | `PAYER_TYPO` | **Policy**: Convert to proper title-casing and normalize to standard user `Priya`. |
| **10** | Cylinder refill | Amount `899.995` contains three decimal places (high precision). | `HIGH_PRECISION_DECIMAL` | **Policy**: Round amount to standard currency format (2 decimals): `900.00`. |
| **11** | Groceries DMart | Payer name has a typo: `Priya S`. | `PAYER_TYPO` | **Policy**: Fuzzy-matched and normalized to standard user `Priya`. |
| **13** | House cleaning supplies | Payer name is empty (`""`); note says "can't remember who paid". | `MISSING_PAYER` | **Policy**: The user is prompted to assign a payer in the wizard (defaults to `Aisha` or as selected). |
| **14** | Rohan paid Aisha back | Settlement transaction is logged as an expense; amount is `5000`, split_type is empty. | `SETTLEMENT_LOGGED_AS_EXPENSE` | **Policy**: Convert from an expense to a direct payback payment from `Rohan` to `Aisha`. |
| **15** | Pizza Friday | Split percentages (`30%`, `30%`, `30%`, `20%`) sum up to `110%` instead of `100%`. | `PERCENTAGE_SUM_MISMATCH` | **Policy**: Normalizes splits proportionally so they sum exactly to 100% of the total cost (₹1440). |
| **16** | March rent | Date format is `01/03/2026` (D/M/Y) while previous dates were `YYYY-MM-DD`. | `INCONSISTENT_DATE_FORMAT` | **Policy**: Auto-detect date string format, parse reliably using regex, and store as `2026-03-01`. |
| **20 & 21**| Goa villa / Beach shack | Expense amounts logged in `USD` ($540 and $84). | `USD_CURRENCY` | **Policy**: Multi-currency conversion from USD to INR at standard ₹83.0/USD exchange rate. |
| **23** | Parasailing | Split list contains non-member visitor name `Dev's friend Kabir`. | `NON_MEMBER_PARTICIPATION` | **Policy**: Create `Kabir` as a temporary visitor user in the database so his debt is tracked. |
| **24 & 25**| Dinner at Thalassa / Thalassa dinner | Double logged duplicate dinner entries by Aisha (₹2400) and Rohan (₹2450) with minor discrepancy. | `DUPLICATE_ENTRY` | **Policy**: Wizard prompts the user to select which entry is correct. Keep Rohan's Row 25 and skip Aisha's Row 24. |
| **26** | Parasailing refund | Amount is negative: `-30` USD. | `REFUND_AMOUNT` | **Policy**: Treat as a negative expense (refund). Splits are negative, reducing each person's debt. |
| **27** | Airport cab | Payer name has inconsistent spacing and lowercase: `"rohan "`. | `PAYER_TYPO` | **Policy**: Trim whitespaces, normalize casing, and resolve to standard user `Rohan`. |
| **28** | Groceries DMart | Currency field is missing (empty cell). | `MISSING_CURRENCY` | **Policy**: Defaults to `INR` based on surrounding chronological context. |
| **29** | Electricity Mar | Amount has leading/trailing whitespaces: ` 1450 `. | `WHITESPACE_CLEANUP` | **Policy**: Trim extra spaces and parse value as numeric `1450.00`. |
| **31** | Dinner order Swiggy | Amount is `0` (zero) with note "counted twice earlier - fixing later". | `ZERO_AMOUNT` | **Policy**: Flagged in wizard. Suggested to skip as it has no monetary value. |
| **34** | Deep cleaning service | Date is `04/05/2026`. Represents April 5 or May 4? | `AMBIGUOUS_DATE_ORDER` | **Policy**: Sequence context analysis: Row 33 is Mar 28, Row 35 is Apr 1. Date is resolved to April 5th. |
| **36** | Groceries BigBasket | Split includes `Meera` on April 2nd, but Meera moved out on March 31st. | `TIMELINE_VIOLATION_MEERA` | **Policy**: Meera is removed from the split, and the cost is split among the active members on that date. |
| **38** | Sam deposit share | Sam paid Aisha deposit of ₹15000, logged as an expense. | `SETTLEMENT_LOGGED_AS_EXPENSE` | **Policy**: Convert from an expense to a direct payback payment from `Sam` to `Aisha`. |
| **42** | Furniture for common room | Split type says "equal" but split details provides shares `Aisha 1; Rohan 1; Priya 1; Sam 1`. | `EQUAL_WITH_SHARES_DETAILS` | **Policy**: Validated as equal split since all shares are 1, and imported as standard equal split. |

---

## 2. Database Schema Design (PostgreSQL)

To preserve transactional integrity, maintain chronological accuracy, and track split shares precisely, a structured relational schema was implemented:

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
        timestamp left_at
    }

    EXPENSES {
        int id PK
        int group_id FK
        string description
        numeric amount
        string currency
        numeric amount_usd
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

    IMPORTS {
        int id PK
        timestamp imported_at
        string filename
        int total_rows
        int imported_rows
        int anomalies_count
    }

    IMPORT_ANOMALIES {
        int id PK
        int import_id FK
        int row_number
        string date_raw
        string description_raw
        string anomaly_type
        text raw_data
        string action_taken
        string resolved_value
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
    IMPORTS ||--o{ IMPORT_ANOMALIES : "logs anomalies"
```

### Table Specifications & Constraints
1. **`users`**: Stores user credentials and profile names.
2. **`groups`**: Stores group entities (e.g., "Flatmates & Trips").
3. **`group_members`**: Join table tracking who belongs to which group. Includes `joined_at` and `left_at` bounds to support chronological split validation.
4. **`expenses`**: Stores expense headers. Support is added for:
   - `amount_usd`: Tracks original USD currency figures to satisfy Priya's request.
   - `amount`: Logged in standard INR. Allows negative values for refunds.
   - Constraint checks to enforce split type boundaries.
5. **`expense_splits`**: Stores the computed cost per participant. Support is added for negative split shares (for refunds).
6. **`payments`**: Stores direct debt-reducing settlements (Aisha's request).
7. **`chat_messages`**: Supports real-time discussions on specific expenses.
8. **`imports` & `import_anomalies`**: Persist CSV parsing audits so users can review duplicate skips and conversions historically (Meera's request).
