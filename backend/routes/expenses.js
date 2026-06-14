const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const {
  splitEqually,
  splitUnequally,
  splitByPercentage,
  splitByShare
} = require('../utils/splits');

// ADD EXPENSE TO GROUP
router.post('/groups/:groupId/expenses', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { description, amount, date, paid_by, split_type, splits } = req.body;

  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'Description is required' });
  }
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }
  if (!paid_by) {
    return res.status(400).json({ error: 'Payer (paid_by) is required' });
  }
  if (!split_type || !['equal', 'unequal', 'percentage', 'share'].includes(split_type)) {
    return res.status(400).json({ error: 'Invalid split type' });
  }
  if (!splits || !Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ error: 'Splits array is required and cannot be empty' });
  }

  const numericAmount = parseFloat(parseFloat(amount).toFixed(2));
  const expenseDate = date ? new Date(date) : new Date();

  // 1. Verify caller is currently an active member of this group
  const callerCheck = await db.query(
    'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE',
    [groupId, req.user.id]
  );
  if (callerCheck.rows.length === 0) {
    return res.status(403).json({ error: 'You are not an active member of this group' });
  }

  // 2. Verify all split participants are members of the group
  const userIdsToCheck = new Set();
  userIdsToCheck.add(parseInt(paid_by));
  
  if (split_type === 'equal') {
    // For equal splits, splits can be an array of userIds
    splits.forEach(item => {
      const uId = typeof item === 'object' ? item.userId : item;
      userIdsToCheck.add(parseInt(uId));
    });
  } else {
    splits.forEach(s => userIdsToCheck.add(parseInt(s.userId)));
  }

  try {
    const membersResult = await db.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND is_active = TRUE',
      [groupId]
    );
    const memberIdsInDb = new Set(membersResult.rows.map(r => r.user_id));

    for (let uId of userIdsToCheck) {
      if (!memberIdsInDb.has(uId)) {
        return res.status(400).json({ error: `User ID ${uId} is not an active member of this group` });
      }
    }

    // 3. Calculate the actual split amounts based on type
    let calculatedSplits = [];
    try {
      if (split_type === 'equal') {
        const participantIds = splits.map(item => typeof item === 'object' ? item.userId : item);
        const results = splitEqually(numericAmount, participantIds);
        calculatedSplits = results.map(r => ({
          userId: r.userId,
          amount: r.amount,
          percentage: null,
          share: null
        }));
      } else if (split_type === 'unequal') {
        const results = splitUnequally(numericAmount, splits);
        calculatedSplits = results.map(r => ({
          userId: r.userId,
          amount: r.amount,
          percentage: null,
          share: null
        }));
      } else if (split_type === 'percentage') {
        const results = splitByPercentage(numericAmount, splits);
        calculatedSplits = results.map(r => ({
          userId: r.userId,
          amount: r.amount,
          percentage: r.percentage,
          share: null
        }));
      } else if (split_type === 'share') {
        const results = splitByShare(numericAmount, splits);
        calculatedSplits = results.map(r => ({
          userId: r.userId,
          amount: r.amount,
          percentage: null,
          share: r.share
        }));
      }
    } catch (calcError) {
      return res.status(400).json({ error: calcError.message });
    }

    // 4. Write to DB using transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert into expenses table
      const insertExpenseResult = await client.query(
        `INSERT INTO expenses (group_id, description, amount, date, paid_by, split_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, group_id, description, amount, date, paid_by, split_type, created_by, created_at`,
        [groupId, description.trim(), numericAmount, expenseDate, paid_by, split_type, req.user.id]
      );
      const expense = insertExpenseResult.rows[0];

      // Insert splits
      for (const s of calculatedSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, share)
           VALUES ($1, $2, $3, $4, $5)`,
          [expense.id, s.userId, s.amount, s.percentage, s.share]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({
        message: 'Expense added successfully',
        expense,
        splits: calculatedSplits
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET EXPENSE DETAILS AND CHAT HISTORY
router.get('/expenses/:id', authenticateToken, async (req, res) => {
  const expenseId = parseInt(req.params.id);
  if (isNaN(expenseId)) {
    return res.status(400).json({ error: 'Invalid expense ID' });
  }

  try {
    // 1. Fetch Expense
    const expenseResult = await db.query(
      `SELECT e.id, e.group_id, e.description, e.amount, e.date, e.paid_by, u.name as paid_by_name, e.split_type, e.created_by, g.name as group_name
       FROM expenses e
       JOIN groups g ON e.group_id = g.id
       JOIN users u ON e.paid_by = u.id
       WHERE e.id = $1`,
      [expenseId]
    );

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    const expense = expenseResult.rows[0];

    // 2. Verify membership to the group of this expense
    const memberCheck = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE',
      [expense.group_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not an active member of the group this expense belongs to' });
    }

    // 3. Fetch splits
    const splitsResult = await db.query(
      `SELECT es.id, es.user_id, u.name as user_name, es.amount, es.percentage, es.share
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1
       ORDER BY u.name ASC`,
      [expenseId]
    );

    // 4. Fetch chat messages
    const chatResult = await db.query(
      `SELECT cm.id, cm.user_id, u.name as user_name, cm.message, cm.created_at
       FROM chat_messages cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.expense_id = $1
       ORDER BY cm.created_at ASC`,
      [expenseId]
    );

    res.json({
      expense,
      splits: splitsResult.rows,
      messages: chatResult.rows
    });
  } catch (error) {
    console.error('Get expense details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
