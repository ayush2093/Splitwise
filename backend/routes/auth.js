const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Rate limiters for authentication endpoints
const registerRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10, // Max 10 registrations per IP
  message: 'Too many registration attempts. Please try again after 15 minutes.'
});

const loginRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20, // Max 20 logins per IP
  message: 'Too many login attempts. Please try again after 15 minutes.'
});

// REGISTER USER
router.post('/register', registerRateLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  const nameTrimmed = typeof name === 'string' ? name.trim() : '';
  const emailTrimmed = typeof email === 'string' ? email.toLowerCase().trim() : '';
  const passwordRaw = typeof password === 'string' ? password : '';

  if (!nameTrimmed || !emailTrimmed || !passwordRaw) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Length constraints to prevent abuse
  if (nameTrimmed.length < 2 || nameTrimmed.length > 50) {
    return res.status(400).json({ error: 'Name must be between 2 and 50 characters long' });
  }
  if (emailTrimmed.length > 100) {
    return res.status(400).json({ error: 'Email must be under 100 characters long' });
  }
  if (passwordRaw.length < 6 || passwordRaw.length > 128) {
    return res.status(400).json({ error: 'Password must be between 6 and 128 characters long' });
  }

  // Robust email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(emailTrimmed)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  // Password strength validation
  if (!/[a-zA-Z]/.test(passwordRaw) || !/\d/.test(passwordRaw)) {
    return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [emailTrimmed]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordRaw, salt);

    // Insert user
    const newUser = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [nameTrimmed, emailTrimmed, passwordHash]
    );

    const user = newUser.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      user,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LOGIN USER
router.post('/login', loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  const emailTrimmed = typeof email === 'string' ? email.toLowerCase().trim() : '';
  const passwordRaw = typeof password === 'string' ? password : '';

  if (!emailTrimmed || !passwordRaw) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [emailTrimmed]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(passwordRaw, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET CURRENT USER
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
