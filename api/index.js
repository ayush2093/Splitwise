const express = require('express');
const cors = require('cors');

// Resolve routes from the backend directory
const authRouter = require('../backend/routes/auth');
const groupsRouter = require('../backend/routes/groups');
const expensesRouter = require('../backend/routes/expenses');
const settlementsRouter = require('../backend/routes/settlements');
const usersRouter = require('../backend/routes/users');
const dashboardRouter = require('../backend/routes/dashboard');
const seedRouter = require('../backend/routes/seed');
const importRouter = require('../backend/routes/import');

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Mount the API routes
app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', expensesRouter);
app.use('/api', settlementsRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/seed', seedRouter);
app.use('/api/import', importRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date(), env: process.env.NODE_ENV });
});

module.exports = app;
