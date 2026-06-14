const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

// Route imports
const authRouter = require('./routes/auth');
const groupsRouter = require('./routes/groups');
const expensesRouter = require('./routes/expenses');
const settlementsRouter = require('./routes/settlements');
const usersRouter = require('./routes/users');
const dashboardRouter = require('./routes/dashboard');
const seedRouter = require('./routes/seed');
const importRouter = require('./routes/import');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Mount REST API routers
app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', expensesRouter); // Mounts /api/groups/:groupId/expenses and /api/expenses/:id
app.use('/api', settlementsRouter); // Mounts /api/groups/:groupId/settlements
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/seed', seedRouter);
app.use('/api/import', importRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Socket.io Setup
const io = new Server(server, {
  cors: corsOptions
});

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return next(new Error('Invalid token'));
    }
    // Attach decoded user to socket instance
    socket.user = decodedUser;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

  // Join a room for a specific expense chat
  socket.on('join_expense', async (expenseId) => {
    const eId = parseInt(expenseId);
    if (isNaN(eId)) {
      socket.emit('error_message', { error: 'Invalid expense ID' });
      return;
    }

    try {
      // Verify user is an active member of the group this expense belongs to
      const groupCheck = await db.query(
        `SELECT e.group_id 
         FROM expenses e
         JOIN group_members gm ON e.group_id = gm.group_id
         WHERE e.id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
        [eId, socket.user.id]
      );

      if (groupCheck.rows.length === 0) {
        console.warn(`User ${socket.user.name} unauthorized to join room for expense ${eId}`);
        socket.emit('error_message', { error: 'Unauthorized to access this expense chat' });
        return;
      }

      const roomName = `expense_${eId}`;
      socket.join(roomName);
      console.log(`User ${socket.user.name} joined room ${roomName}`);
    } catch (err) {
      console.error('Error joining expense room:', err);
      socket.emit('error_message', { error: 'Internal server error while joining chat' });
    }
  });

  // Leave a room
  socket.on('leave_expense', (expenseId) => {
    const eId = parseInt(expenseId);
    if (isNaN(eId)) return;
    const roomName = `expense_${eId}`;
    socket.leave(roomName);
    console.log(`User ${socket.user.name} left room ${roomName}`);
  });

  // Handle incoming chat messages
  socket.on('send_message', async (data) => {
    const { expenseId, message } = data;
    const eId = parseInt(expenseId);

    if (isNaN(eId) || !message || message.trim() === '') {
      return;
    }

    try {
      // 1. Verify user is currently an active member of the group this expense belongs to
      const groupCheck = await db.query(
        `SELECT e.group_id 
         FROM expenses e
         JOIN group_members gm ON e.group_id = gm.group_id
         WHERE e.id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
        [eId, socket.user.id]
      );

      if (groupCheck.rows.length === 0) {
        console.warn(`User ${socket.user.name} unauthorized to post message in expense ${eId}`);
        socket.emit('error_message', { error: 'Unauthorized to post in this expense chat' });
        return;
      }

      // 2. Insert message into DB
      const result = await db.query(
        `INSERT INTO chat_messages (expense_id, user_id, message)
         VALUES ($1, $2, $3)
         RETURNING id, message, created_at`,
        [eId, socket.user.id, message.trim()]
      );

      const dbMessage = result.rows[0];

      // 3. Format complete message payload
      const payload = {
        id: dbMessage.id,
        expense_id: eId,
        user_id: socket.user.id,
        user_name: socket.user.name,
        message: dbMessage.message,
        created_at: dbMessage.created_at
      };

      // 4. Broadcast to the expense room
      const roomName = `expense_${eId}`;
      io.to(roomName).emit('receive_message', payload);
      
    } catch (err) {
      console.error('Error handling send_message in socket:', err);
      socket.emit('error_message', { error: 'Failed to deliver message' });
    }
  });

  // Handle typing indicators (requires that the user is actively inside the room)
  socket.on('typing', (data) => {
    const { expenseId } = data;
    const eId = parseInt(expenseId);
    if (isNaN(eId)) return;
    const roomName = `expense_${eId}`;
    if (!socket.rooms.has(roomName)) return; // Guard: must be joined to room
    socket.to(roomName).emit('user_typing', {
      userId: socket.user.id,
      userName: socket.user.name
    });
  });

  socket.on('stop_typing', (data) => {
    const { expenseId } = data;
    const eId = parseInt(expenseId);
    if (isNaN(eId)) return;
    const roomName = `expense_${eId}`;
    if (!socket.rooms.has(roomName)) return; // Guard: must be joined to room
    socket.to(roomName).emit('user_stop_typing', {
      userId: socket.user.id
    });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Express server and initialize database tables
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Verify database tables are initialized
    await db.initDatabase();

    server.listen(PORT, () => {
      console.log(`Express and Socket.io server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
