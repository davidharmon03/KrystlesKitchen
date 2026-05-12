require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { compressImage } = require('../utils/compressImage');

// Canonical default notification preferences — all on by default.
// Exported so notifications.js and digest.js can reference them.
const DEFAULT_NOTIFICATION_PREFS = {
  email_digest:     true,
  in_app_swap:      true,
  in_app_korner:    true,
  in_app_kuzine:    true,
  in_app_kultivate: true,
  in_app_orders:    true,
  expiry_reminders: true,
};
module.exports.DEFAULT_NOTIFICATION_PREFS = DEFAULT_NOTIFICATION_PREFS;

const avatarDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// memoryStorage — buffer handed to compressImage before writing to disk
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

function makeTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

// Validation chains
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// POST /api/auth/register
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { name, email, password, invite_token } = req.body;

    const db = await getDb();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await db.run('INSERT INTO users (id, name, email, password) VALUES (?,?,?,?)',
      [id, name, email, password_hash]);

    // Accept any pending invite for this email
    if (invite_token) {
      const inv = await db.get(
        "SELECT * FROM group_invitations WHERE token = ? AND status = 'pending'",
        [invite_token]
      );
      if (inv && inv.email.toLowerCase() === email.toLowerCase()) {
        const count = await db.get('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [inv.group_id]);
        if (count.c < 5) {
          await db.run('INSERT OR IGNORE INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
            [uuidv4(), inv.group_id, id]);
          await db.run("UPDATE group_invitations SET status = 'accepted' WHERE token = ?", [invite_token]);
        }
      }
    } else {
      const inv = await db.get(
        "SELECT * FROM group_invitations WHERE email = ? AND status = 'pending' LIMIT 1",
        [email.toLowerCase()]
      );
      if (inv) {
        const count = await db.get('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [inv.group_id]);
        if (count.c < 5) {
          await db.run('INSERT OR IGNORE INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
            [uuidv4(), inv.group_id, id]);
          await db.run("UPDATE group_invitations SET status = 'accepted' WHERE id = ?", [inv.id]);
        }
      }
    }

    const accessToken = jwt.sign({ id, name, email }, JWT_SECRET, { expiresIn: '15m' });
    const refreshTokenValue = crypto.randomBytes(32).toString('hex');
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [id, refreshTokenValue, refreshExpires]
    );

    const groups = await _getUserGroups(db, id);
    res.status(201).json({
      token: accessToken,
      refreshToken: refreshTokenValue,
      user: { id, name, email, groups }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshTokenValue = crypto.randomBytes(32).toString('hex');
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [user.id, refreshTokenValue, refreshExpires]
    );

    const groups = await _getUserGroups(db, user.id);
    const payload = {
      token: accessToken,
      refreshToken: refreshTokenValue,
      user: { id: user.id, name: user.name, email: user.email, groups }
    };
    if (user.must_change_password === 1) payload.mustChangePassword = true;

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const db = await getDb();
    const stored = await db.get(
      "SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0",
      [refreshToken]
    );
    if (!stored) return res.status(401).json({ error: 'Invalid or revoked refresh token' });
    if (new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = await db.get('SELECT id, name, email FROM users WHERE id = ?', [stored.user_id]);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ token: accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const db = await getDb();
    await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', [refreshToken]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { email } = req.body;
    const db = await getDb();
    const user = await db.get('SELECT id, name FROM users WHERE email = ?', [email]);

    // Always return success to prevent email enumeration
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await db.run(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [user.id, token, expires]
    );

    if (!process.env.EMAIL_USER) {
      console.warn('[forgot-password] EMAIL_USER not set — skipping email send');
      return res.json({ ok: true });
    }

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    const transport = makeTransport();
    await transport.sendMail({
      from:    `"Krystle's Brand Hub" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: "Reset your Krystle's Brand Hub password",
      html: `
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your password. Click the link below to set a new password. This link expires in 1 hour.</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you didn't request a password reset, you can ignore this email.</p>
        <p>— Krystle's Brand Hub</p>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { token, newPassword } = req.body;
    const db = await getDb();

    const record = await db.get(
      "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0",
      [token]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or already used reset token' });
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?',
      [password_hash, record.user_id]);
    await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [record.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get('SELECT id, name, email, social_links, avatar_path, sync_mode, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const groups = await _getUserGroups(db, user.id);
    let social_links = {};
    try { social_links = JSON.parse(user.social_links || '{}') } catch {}
    res.json({ ...user, social_links, groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, social_links, sync_mode } = req.body;
    const db = await getDb();
    const updates = [];
    const params = [];

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (social_links !== undefined) {
      updates.push('social_links = ?');
      params.push(JSON.stringify(social_links));
    }
    if (sync_mode !== undefined && ['auto', 'manual'].includes(sync_mode)) {
      updates.push('sync_mode = ?');
      params.push(sync_mode);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.user.id);
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    const user = await db.get('SELECT id, name, email, social_links, avatar_path, sync_mode, created_at FROM users WHERE id = ?', [req.user.id]);
    const groups = await _getUserGroups(db, user.id);
    let parsed_links = {};
    try { parsed_links = JSON.parse(user.social_links || '{}') } catch {}
    res.json({ ...user, social_links: parsed_links, groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/avatar
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = await compressImage(req.file.buffer, avatarDir, req.user.id, { maxWidth: 400 });
    const db = await getDb();
    const relativePath = `avatars/${filename}`;
    await db.run('UPDATE users SET avatar_path = ? WHERE id = ?', [relativePath, req.user.id]);
    const user = await db.get('SELECT id, name, email, social_links, avatar_path, created_at FROM users WHERE id = ?', [req.user.id]);
    const groups = await _getUserGroups(db, user.id);
    let social_links = {};
    try { social_links = JSON.parse(user.social_links || '{}') } catch {}
    res.json({ ...user, social_links, groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/notification-prefs
router.get('/notification-prefs', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT notification_prefs FROM users WHERE id = ?', [req.user.id]);
    let prefs = {};
    try { prefs = JSON.parse(row?.notification_prefs || '{}'); } catch {}
    res.json({ ...DEFAULT_NOTIFICATION_PREFS, ...prefs });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/auth/notification-prefs
router.put('/notification-prefs', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT notification_prefs FROM users WHERE id = ?', [req.user.id]);
    let existing = {};
    try { existing = JSON.parse(row?.notification_prefs || '{}'); } catch {}
    // Only allow known keys — merge with existing
    const merged = { ...existing };
    for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
      if (key in req.body) merged[key] = Boolean(req.body[key]);
    }
    await db.run('UPDATE users SET notification_prefs = ? WHERE id = ?',
      [JSON.stringify(merged), req.user.id]);
    res.json({ ...DEFAULT_NOTIFICATION_PREFS, ...merged });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

async function _getUserGroups(db, userId) {
  return db.all(`
    SELECT g.id, g.name, g.invite_code, g.owner_id,
           (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `, [userId]);
}

module.exports = router;
