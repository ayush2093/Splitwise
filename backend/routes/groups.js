const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { minimizeDebts } = require('../utils/debtMinimizer');

// CREATE GROUP
router.post('/', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Create group
    const newGroupResult = await client.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at',
      [name.trim(), req.user.id]
    );
    const group = newGroupResult.rows[0];

    // Add creator as member
    await client.query(
      'INSERT INTO group_members (group_id, user_id, is_active) VALUES ($1, $2, TRUE)',
      [group.id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Group created successfully', group });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// LIST GROUPS CURRENT USER BELONGS TO
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.id, g.name, g.created_by, g.created_at, gm.is_active
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1 AND gm.is_active = TRUE
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json({ groups: result.rows });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET GROUP DETAILS, MEMBERS, EXPENSES, PAYMENTS, BALANCES
router.get('/:id', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }

  try {
    // 1. Verify user is currently an active member of this group
    const memberCheck = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE',
      [groupId, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    // 2. Fetch Group Metadata
    const groupResult = await db.query(
      `SELECT g.id, g.name, g.created_by, g.created_at, u.name as creator_name
       FROM groups g
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.id = $1`,
      [groupId]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = groupResult.rows[0];

    // 3. Fetch Group Members
    const membersResult = await db.query(
      `SELECT u.id, u.name, u.email, gm.is_active, gm.joined_at, gm.left_at
       FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY u.name ASC`,
      [groupId]
    );
    const members = membersResult.rows;

    // 4. Fetch Expenses
    const expensesResult = await db.query(
      `SELECT e.id, e.description, e.amount, e.date, e.paid_by, u.name as paid_by_name, e.split_type, e.created_at
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       WHERE e.group_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [groupId]
    );
    const expenses = expensesResult.rows;

    // 5. Fetch Splits for all those expenses
    const splitsResult = await db.query(
      `SELECT es.expense_id, es.user_id, u.name as user_name, es.amount, es.percentage, es.share
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       JOIN users u ON es.user_id = u.id
       WHERE e.group_id = $1`,
      [groupId]
    );
    const splits = splitsResult.rows;

    // 6. Fetch Payments (Settlements)
    const paymentsResult = await db.query(
      `SELECT p.id, p.from_user_id, u1.name as from_user_name, p.to_user_id, u2.name as to_user_name, p.amount, p.date, p.created_at
       FROM payments p
       JOIN users u1 ON p.from_user_id = u1.id
       JOIN users u2 ON p.to_user_id = u2.id
       WHERE p.group_id = $1
       ORDER BY p.date DESC, p.created_at DESC`,
      [groupId]
    );
    const payments = paymentsResult.rows;

    // --- Dynamic Balance and Debt calculations ---
    // User objects lookup
    const usersMap = {};
    members.forEach(m => {
      usersMap[m.id] = {
        id: m.id,
        name: m.name,
        email: m.email,
        isActive: m.is_active,
        totalPaid: 0,
        totalOwed: 0,
        totalSent: 0,
        totalReceived: 0
      };
    });

    // Accumulate Expense Paid Amounts
    expenses.forEach(e => {
      if (usersMap[e.paid_by]) {
        usersMap[e.paid_by].totalPaid += parseFloat(e.amount);
      }
    });

    // Accumulate Expense Owed Splits
    splits.forEach(s => {
      if (usersMap[s.user_id]) {
        usersMap[s.user_id].totalOwed += parseFloat(s.amount);
      }
    });

    // Accumulate Payments (Settlements)
    payments.forEach(p => {
      if (usersMap[p.from_user_id]) {
        usersMap[p.from_user_id].totalSent += parseFloat(p.amount);
      }
      if (usersMap[p.to_user_id]) {
        usersMap[p.to_user_id].totalReceived += parseFloat(p.amount);
      }
    });

    // Calculate Net Balance per user
    const userBalances = {};
    Object.keys(usersMap).forEach(userId => {
      const u = usersMap[userId];
      const net = (u.totalPaid + u.totalSent) - (u.totalOwed + u.totalReceived);
      userBalances[userId] = parseFloat(net.toFixed(2));
    });

    // Pairwise direct debts calculation
    // Debt[A][B] = what A owes B directly
    const directDebts = {};
    const memberIds = members.map(m => m.id);

    // Initialize 2D debt map
    memberIds.forEach(idA => {
      directDebts[idA] = {};
      memberIds.forEach(idB => {
        directDebts[idA][idB] = 0;
      });
    });

    // Add owed splits: if expense was paid by B, and A has a split, A owes B that split amount
    expenses.forEach(e => {
      const payerId = e.paid_by;
      const expenseSplits = splits.filter(s => s.expense_id === e.id);
      expenseSplits.forEach(s => {
        const participantId = s.user_id;
        if (participantId !== payerId) {
          if (directDebts[participantId] && directDebts[participantId][payerId] !== undefined) {
            directDebts[participantId][payerId] += parseFloat(s.amount);
          }
        }
      });
    });

    // Subtract payments/settlements: if A paid B directly as a settlement, reduce what A owes B
    payments.forEach(p => {
      const fromId = p.from_user_id;
      const toId = p.to_user_id;
      if (directDebts[fromId] && directDebts[fromId][toId] !== undefined) {
        directDebts[fromId][toId] -= parseFloat(p.amount);
      }
    });

    // Calculate net pairwise debts (A owes B net difference) - direct matching
    const netDebts = [];
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const idA = memberIds[i];
        const idB = memberIds[j];
        
        const debtAToB = directDebts[idA][idB];
        const debtBToA = directDebts[idB][idA];
        
        const netDiff = debtAToB - debtBToA;
        if (netDiff > 0.005) {
          netDebts.push({
            fromUser: { id: idA, name: usersMap[idA].name },
            toUser: { id: idB, name: usersMap[idB].name },
            amount: parseFloat(netDiff.toFixed(2))
          });
        } else if (netDiff < -0.005) {
          netDebts.push({
            fromUser: { id: idB, name: usersMap[idB].name },
            toUser: { id: idA, name: usersMap[idA].name },
            amount: parseFloat(Math.abs(netDiff).toFixed(2))
          });
        }
      }
    }

    // Calculate optimal minimized debts (Aisha's view)
    const usersLookupForMinimizer = {};
    Object.keys(usersMap).forEach(uId => {
      usersLookupForMinimizer[uId] = usersMap[uId].name;
    });
    const minimizedDebts = minimizeDebts(userBalances, usersLookupForMinimizer);

    res.json({
      group,
      members,
      expenses,
      payments,
      balances: userBalances,
      debts: netDebts,
      minimizedDebts
    });
  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ADD MEMBER TO GROUP (By email search)
router.post('/:id/members', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const { email } = req.body;

  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  if (!email || email.trim() === '') {
    return res.status(400).json({ error: 'Member email is required' });
  }

  try {
    // 1. Verify caller is currently an active member of this group
    const callerCheck = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE',
      [groupId, req.user.id]
    );
    if (callerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only active members can add users to the group' });
    }

    // 2. Find user to add
    const userResult = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user registered with this email address' });
    }
    const userToAdd = userResult.rows[0];

    // 3. Check membership status
    const memberCheck = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userToAdd.id]
    );

    if (memberCheck.rows.length > 0) {
      if (memberCheck.rows[0].is_active) {
        return res.status(400).json({ error: 'User is already a member of this group' });
      } else {
        // Re-activate membership
        await db.query(
          'UPDATE group_members SET is_active = TRUE WHERE group_id = $1 AND user_id = $2',
          [groupId, userToAdd.id]
        );
        return res.json({ message: 'User re-added to group successfully', user: userToAdd });
      }
    }

    // 4. Insert membership
    await db.query(
      'INSERT INTO group_members (group_id, user_id, is_active) VALUES ($1, $2, TRUE)',
      [groupId, userToAdd.id]
    );

    res.status(201).json({ message: 'User added to group successfully', user: userToAdd });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// REMOVE MEMBER FROM GROUP
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const userIdToRemove = parseInt(req.params.userId);

  if (isNaN(groupId) || isNaN(userIdToRemove)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    // 1. Verify caller is the creator of the group
    const groupResult = await db.query('SELECT created_by FROM groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = groupResult.rows[0];

    if (group.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the group creator can remove members' });
    }

    if (userIdToRemove === req.user.id) {
      return res.status(400).json({ error: 'Group creator cannot be removed from the group' });
    }

    // 2. Verify target user is currently a member and is active
    const checkTargetActive = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userIdToRemove]
    );
    if (checkTargetActive.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }
    if (!checkTargetActive.rows[0].is_active) {
      return res.status(400).json({ error: 'User is already inactive in this group' });
    }

    // 3. Calculate target user's group balance to ensure it is 0
    const paidRes = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM expenses WHERE group_id = $1 AND paid_by = $2',
      [groupId, userIdToRemove]
    );
    const totalPaid = parseFloat(paidRes.rows[0].total_paid);

    const owedRes = await db.query(
      `SELECT COALESCE(SUM(es.amount), 0) as total_owed 
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.group_id = $1 AND es.user_id = $2`,
      [groupId, userIdToRemove]
    );
    const totalOwed = parseFloat(owedRes.rows[0].total_owed);

    const sentRes = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total_sent FROM payments WHERE group_id = $1 AND from_user_id = $2',
      [groupId, userIdToRemove]
    );
    const totalSent = parseFloat(sentRes.rows[0].total_sent);

    const receivedRes = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total_received FROM payments WHERE group_id = $1 AND to_user_id = $2',
      [groupId, userIdToRemove]
    );
    const totalReceived = parseFloat(receivedRes.rows[0].total_received);

    const balance = (totalPaid + totalSent) - (totalOwed + totalReceived);
    if (Math.abs(balance) > 0.005) {
      return res.status(400).json({ 
        error: `Cannot remove member. User has an outstanding balance of $${balance.toFixed(2)} in this group.` 
      });
    }

    // 4. Set is_active = FALSE (soft remove)
    const result = await db.query(
      'UPDATE group_members SET is_active = FALSE WHERE group_id = $1 AND user_id = $2 RETURNING *',
      [groupId, userIdToRemove]
    );

    res.json({ message: 'User removed from group successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET MEMBER LEDGER
router.get('/:id/ledger/:userId', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  if (isNaN(groupId) || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid group or user ID' });
  }

  try {
    // Verify caller is member of group
    const memberCheck = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to view group details' });
    }

    // 1. Fetch all expenses in the group paid by or split with this user
    const expensesRes = await db.query(
      `SELECT e.id, e.description, e.amount as total_amount, e.currency, e.amount_usd, e.date, e.paid_by, u.name as paid_by_name,
              es.amount as user_share
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       LEFT JOIN expense_splits es ON e.id = es.expense_id AND es.user_id = $2
       WHERE e.group_id = $1 AND (e.paid_by = $2 OR es.user_id = $2)
       ORDER BY e.date ASC`,
      [groupId, userId]
    );

    // 2. Fetch all payments in the group involving this user
    const paymentsRes = await db.query(
      `SELECT p.id, p.amount, p.date, p.from_user_id, u1.name as from_name, p.to_user_id, u2.name as to_name
       FROM payments p
       JOIN users u1 ON p.from_user_id = u1.id
       JOIN users u2 ON p.to_user_id = u2.id
       WHERE p.group_id = $1 AND (p.from_user_id = $2 OR p.to_user_id = $2)
       ORDER BY p.date ASC`,
      [groupId, userId]
    );

    // Merge and format ledger entries
    const entries = [];

    expensesRes.rows.forEach(exp => {
      const isPayer = exp.paid_by === userId;
      const share = parseFloat(exp.user_share || 0);
      const total = parseFloat(exp.total_amount);
      
      let netEffect = 0;
      if (isPayer) netEffect += total;
      netEffect -= share;

      entries.push({
        type: 'expense',
        id: exp.id,
        date: exp.date,
        description: exp.description,
        totalAmount: total,
        currency: exp.currency,
        amountUsd: exp.amount_usd ? parseFloat(exp.amount_usd) : null,
        paidBy: exp.paid_by_name,
        userShare: share,
        netEffect: parseFloat(netEffect.toFixed(2))
      });
    });

    paymentsRes.rows.forEach(p => {
      const isFrom = p.from_user_id === userId;
      const amount = parseFloat(p.amount);
      const netEffect = isFrom ? amount : -amount;

      entries.push({
        type: 'payment',
        id: p.id,
        date: p.date,
        description: isFrom ? `Paid ${p.to_name} back` : `Received payment from ${p.from_name}`,
        totalAmount: amount,
        currency: 'INR',
        amountUsd: null,
        paidBy: p.from_name,
        userShare: amount,
        netEffect: parseFloat(netEffect.toFixed(2))
      });
    });

    // Sort entries chronologically
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      userId,
      entries
    });
  } catch (error) {
    console.error('Fetch ledger error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
