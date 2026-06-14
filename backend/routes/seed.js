const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure mock users exist
    const mockUsersData = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Charlie', email: 'charlie@example.com' }
    ];

    const mockUserIds = {};
    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    for (const mu of mockUsersData) {
      const existCheck = await client.query('SELECT id FROM users WHERE email = $1', [mu.email]);
      if (existCheck.rows.length > 0) {
        mockUserIds[mu.name] = existCheck.rows[0].id;
      } else {
        const insertRes = await client.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          [mu.name, mu.email, defaultPasswordHash]
        );
        mockUserIds[mu.name] = insertRes.rows[0].id;
      }
    }

    // 2. Create the demo group "Road Trip 2026"
    const groupResult = await client.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id',
      ['Road Trip 2026', userId]
    );
    const groupId = groupResult.rows[0].id;

    // 3. Add members (Creator + Alice + Bob + Charlie)
    const membersToInsert = [userId, mockUserIds.Alice, mockUserIds.Bob, mockUserIds.Charlie];
    for (const mId of membersToInsert) {
      await client.query(
        'INSERT INTO group_members (group_id, user_id, is_active) VALUES ($1, $2, TRUE) ON CONFLICT (group_id, user_id) DO UPDATE SET is_active = TRUE',
        [groupId, mId]
      );
    }

    // 4. Seed Expense 1: Gasoline ($60.00), paid by Current User, split EQUALLY
    const exp1Res = await client.query(
      `INSERT INTO expenses (group_id, description, amount, date, paid_by, split_type, created_by)
       VALUES ($1, $2, $3, NOW() - INTERVAL '3 days', $4, $5, $4) RETURNING id`,
      [groupId, 'Gasoline', 60.00, userId, 'equal']
    );
    const exp1Id = exp1Res.rows[0].id;
    // Splits: $15.00 each
    for (const mId of membersToInsert) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, 15.00)',
        [exp1Id, mId]
      );
    }

    // 5. Seed Expense 2: Airbnb rental ($400.00), paid by Alice, split PERCENTAGE: Alice 40%, User 20%, Bob 20%, Charlie 20%
    const exp2Res = await client.query(
      `INSERT INTO expenses (group_id, description, amount, date, paid_by, split_type, created_by)
       VALUES ($1, $2, $3, NOW() - INTERVAL '2 days', $4, $5, $4) RETURNING id`,
      [groupId, 'Airbnb cabin', 400.00, mockUserIds.Alice, 'percentage']
    );
    const exp2Id = exp2Res.rows[0].id;
    // Splits
    const percentSplits = [
      { uId: mockUserIds.Alice, pct: 40, amt: 160.00 },
      { uId: userId, pct: 20, amt: 80.00 },
      { uId: mockUserIds.Bob, pct: 20, amt: 80.00 },
      { uId: mockUserIds.Charlie, pct: 20, amt: 80.00 }
    ];
    for (const s of percentSplits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)',
        [exp2Id, s.uId, s.amt, s.pct]
      );
    }

    // 6. Seed Expense 3: Amusement Park Tickets ($120.00), paid by Bob, split SHARES: Bob (2), Charlie (1), User (1)
    const exp3Res = await client.query(
      `INSERT INTO expenses (group_id, description, amount, date, paid_by, split_type, created_by)
       VALUES ($1, $2, $3, NOW() - INTERVAL '1 day', $4, $5, $4) RETURNING id`,
      [groupId, 'Amusement Park Tickets', 120.00, mockUserIds.Bob, 'share']
    );
    const exp3Id = exp3Res.rows[0].id;
    // Splits (Total shares = 4. Bob owes $60, Charlie $30, User $30)
    const shareSplits = [
      { uId: mockUserIds.Bob, sh: 2, amt: 60.00 },
      { uId: mockUserIds.Charlie, sh: 1, amt: 30.00 },
      { uId: userId, sh: 1, amt: 30.00 }
    ];
    for (const s of shareSplits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount, share) VALUES ($1, $2, $3, $4)',
        [exp3Id, s.uId, s.amt, s.sh]
      );
    }

    // 7. Seed Expense 4: Road Dinner ($85.00), paid by Charlie, split UNEQUALLY: Charlie $25, Alice $20, Bob $20, User $20
    const exp4Res = await client.query(
      `INSERT INTO expenses (group_id, description, amount, date, paid_by, split_type, created_by)
       VALUES ($1, $2, $3, NOW() - INTERVAL '4 hours', $4, $5, $4) RETURNING id`,
      [groupId, 'Roadhouse Dinner', 85.00, mockUserIds.Charlie, 'unequal']
    );
    const exp4Id = exp4Res.rows[0].id;
    // Splits
    const unequalSplits = [
      { uId: mockUserIds.Charlie, amt: 25.00 },
      { uId: mockUserIds.Alice, amt: 20.00 },
      { uId: mockUserIds.Bob, amt: 20.00 },
      { uId: userId, amt: 20.00 }
    ];
    for (const s of unequalSplits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
        [exp4Id, s.uId, s.amt]
      );
    }

    // 8. Seed 1 Settlement Payment: Current User paid Alice $50.00
    await client.query(
      `INSERT INTO payments (group_id, from_user_id, to_user_id, amount, date)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '12 hours')`,
      [groupId, userId, mockUserIds.Alice, 50.00]
    );

    // 9. Seed chat messages on Gasoline
    const chatMsgs = [
      { uId: mockUserIds.Alice, msg: 'Thanks for driving and covering the gas!' },
      { uId: userId, msg: 'No worries! Happy to split it equally.' },
      { uId: mockUserIds.Bob, msg: 'Awesome roadtrip guys. Sent my share!' }
    ];
    for (const c of chatMsgs) {
      await client.query(
        'INSERT INTO chat_messages (expense_id, user_id, message, created_at) VALUES ($1, $2, $3, NOW() - INTERVAL \'2 days\')',
        [exp1Id, c.uId, c.msg]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Demo data seeded successfully', groupId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed demo data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
