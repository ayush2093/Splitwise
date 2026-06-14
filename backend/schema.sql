-- PostgreSQL Database Schema for Shared Expenses App (Spreetail Assignment)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group Members join table (with timeline tracking)
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);

-- Expenses table (Supports negative amounts for refunds, original USD amount)
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL, -- Allowed to be negative/zero
    currency VARCHAR(10) DEFAULT 'INR',
    amount_usd NUMERIC(12, 2),
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_by INTEGER REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    split_type VARCHAR(50) NOT NULL CHECK (split_type IN ('equal', 'unequal', 'percentage', 'share')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense splits table (who owes what)
CREATE TABLE IF NOT EXISTS expense_splits (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL, -- Allowed to be negative/zero
    percentage NUMERIC(5, 2),
    share NUMERIC(12, 2)
);

-- Payments (settlements) table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    from_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    to_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_different_users CHECK (from_user_id <> to_user_id)
);

-- Chat messages for expense discussion
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Imports summary log
CREATE TABLE IF NOT EXISTS imports (
    id SERIAL PRIMARY KEY,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filename VARCHAR(255) NOT NULL,
    total_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    anomalies_count INTEGER DEFAULT 0
);

-- Import anomalies log
CREATE TABLE IF NOT EXISTS import_anomalies (
    id SERIAL PRIMARY KEY,
    import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE,
    row_number INTEGER,
    date_raw VARCHAR(50),
    description_raw VARCHAR(255),
    anomaly_type VARCHAR(100) NOT NULL, -- e.g. 'DUPLICATE', 'MISSING_PAYER', 'USD_CURRENCY', etc.
    raw_data TEXT,
    action_taken TEXT NOT NULL,
    resolved_value TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_expense ON chat_messages(expense_id);
CREATE INDEX IF NOT EXISTS idx_import_anomalies_import ON import_anomalies(import_id);
