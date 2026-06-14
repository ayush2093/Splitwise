# Splitwise Clone App

### 🔗 Live Link: [https://splitwise-fullstack-pi.vercel.app](https://splitwise-fullstack-pi.vercel.app)

---

## 🔑 Demo Credentials (for Evaluation)
The database has been pre-seeded with all expenses and flatmate accounts from the Spreetail CSV. **You can log in directly using the following credentials or use the "Evaluation Quick Login" buttons on the login page**:

- **Default Password**: `password123` (for all accounts)
- **Accounts**:
  - `aisha@example.com` (Aisha - test simplified payments, net debt balances)
  - `rohan@example.com` (Rohan - test itemized ledger, transaction history)
  - `priya@example.com` (Priya - test multi-currency conversion USD -> INR)
  - `sam@example.com` (Sam - test timeline constraints: joined group mid-April)
  - `meera@example.com` (Meera - test duplicate checker & inactive members)

---

## 📄 Required Submission Documents
To facilitate evaluation, we have compiled the detailed requirements, database schemas, algorithms, and AI case studies in the following files:

1. [SCOPE.md](file:///Users/ayushsinghchauhan/Desktop/internship/SCOPE.md) – Contains the fully compiled Anomaly log (all 20+ anomalies identified/resolved), plus the Relational Database PostgreSQL schema.
2. [DECISIONS.md](file:///Users/ayushsinghchauhan/Desktop/internship/DECISIONS.md) – Explains architectural and algorithm choices (greedy debt minimizer, dual ledger model, timeline constraint filtering).
3. [AI_USAGE.md](file:///Users/ayushsinghchauhan/Desktop/internship/AI_USAGE.md) – Details how AI was used, prompts used, and 3 case studies of code corrections made.

---

## 🛠 Tech Stack

- **Frontend**: React (Vite SPA), Vanilla CSS, Socket.io-client, React Router.
- **Backend**: Node.js, Express, Socket.io (WebSockets).
- **Database**: PostgreSQL (Relational Database).
- **Authentication**: JWT (JSON Web Tokens) with password hashing via bcryptjs.
- **Testing**: Jest (Unit testing split math).

---

## 🚀 Local Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- A PostgreSQL database instance (local or managed like Neon / Supabase)

### 1. Database Setup
Create a PostgreSQL database. The application is designed to automatically run the `schema.sql` script on startup to initialize and verify tables.

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` folder:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://username:password@localhost:5432/splitwise_db
   JWT_SECRET=supersecretkeyforlocaldev
   NODE_ENV=development
   ```
4. Start the server:
   ```bash
   npm run start
   ```
   *For development with auto-reload, you can run `npm run dev`.*

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` folder:
   ```env
   VITE_BACKEND_URL=http://localhost:5000/api
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser to the URL output by Vite (usually `http://localhost:5173`).

---

## 🧪 Running Unit Tests

To verify that the split calculation algorithms correctly distribute totals and handle decimal rounding adjustments:
```bash
cd backend
npm test
```

---

## 🤖 AI Collaboration Details

- **AI Tool Used**: Antigravity, designed by the Google DeepMind team.
- **Process**: 
  - Conducted an interactive scoping interview before writing code.
  - Formulated a shared project document (`AI_CONTEXT.md`) and implementation roadmap (`implementation_plan.md`).
  - Iteratively verified changes using Jest unit tests and Vite production builds.
