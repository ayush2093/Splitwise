const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// RECORD A SETTLEMENT PAYMENT
router.post('/groups/:groupId/settlements', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { from_user_id, to_user_id, amount, date } = req.body;

  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  if (!from_user_id || !to_user_id) {
    return res.status(400).json({ error: 'Payer (from_user_id) and Payee (to_user_id) are required' });
  }
  if (parseInt(from_user_id) === parseInt(to_user_id)) {
    return res.status(400).json({ error: 'Cannot record a settlement to yourself' });
  }
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Settlement amount must be greater than zero' });
  }

  const numericAmount = parseFloat(parseFloat(amount).toFixed(2));
  const paymentDate = date ? new Date(date) : new Date();

  try {
    // 1. Verify caller is currently an active member of this group
    const callerCheck = await db.query(
      'SELECT is_active FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE',
      [groupId, req.user.id]
    );
    if (callerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    // 2. Verify both payer and payee are active members of this group
    const membersResult = await db.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND is_active = TRUE',
      [groupId]
    );
    const memberIds = new Set(membersResult.rows.map(r => r.user_id));

    if (!memberIds.has(parseInt(from_user_id))) {
      return res.status(400).json({ error: 'Payer is not an active member of this group' });
    }
    if (!memberIds.has(parseInt(to_user_id))) {
      return res.status(400).json({ error: 'Payee is not an active member of this group' });
    }

    // 3. Record the settlement in payments table
    const result = await db.query(
      `INSERT INTO payments (group_id, from_user_id, to_user_id, amount, date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, group_id, from_user_id, to_user_id, amount, date, created_at`,
      [groupId, from_user_id, to_user_id, numericAmount, paymentDate]
    );

    res.status(201).json({
      message: 'Settlement payment recorded successfully',
      payment: result.rows[0]
    });
  } catch (error) {
    console.error('Record settlement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
