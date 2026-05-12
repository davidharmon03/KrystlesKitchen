const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/users/search?q=
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const db = await getDb();
    const pattern = `%${q}%`;
    const rows = await db.all(
      `SELECT id, name, email FROM users
       WHERE (name LIKE ? OR email LIKE ?) AND id != ?
       LIMIT 10`,
      [pattern, pattern, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
