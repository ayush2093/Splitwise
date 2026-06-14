const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// SEARCH USER BY EMAIL
router.get('/search', authenticateToken, async (req, res) => {
  const { email } = req.query;

  if (!email || email.trim() === '') {
    return res.status(400).json({ error: 'Search email query parameter is required' });
  }

  try {
    const result = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with this email' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
