const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const PAGE_SIZE = 100;

async function requireMember(db, groupId, userId) {
  return db.get(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
}

// ── GET /api/chat/:groupId ────────────────────────────────────────────────────
// Returns the most recent PAGE_SIZE messages, oldest-first (client reverses for display).
// Supports ?before=<iso> for "load older" pagination.
router.get('/:groupId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    if (!await requireMember(db, req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const { before } = req.query;
    const params = [req.params.groupId];
    let timeClause = '';
    if (before) {
      timeClause = 'AND m.created_at < ?';
      params.push(before);
    }

    // Fetch newest PAGE_SIZE, then reverse so client gets chronological order
    const rows = await db.all(`
      SELECT m.id, m.content, m.created_at, m.deleted,
             u.id AS user_id, u.name AS user_name, u.avatar_path
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ? AND m.deleted = 0 ${timeClause}
      ORDER BY m.created_at DESC
      LIMIT ${PAGE_SIZE}
    `, params);

    res.json(rows.reverse());
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/chat/:groupId/since/:iso ─────────────────────────────────────────
// Polling endpoint — returns messages created strictly after the given ISO timestamp.
router.get('/:groupId/since/:iso', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    if (!await requireMember(db, req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const rows = await db.all(`
      SELECT m.id, m.content, m.created_at, m.deleted,
             u.id AS user_id, u.name AS user_name, u.avatar_path
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ? AND m.deleted = 0 AND m.created_at > ?
      ORDER BY m.created_at ASC
    `, [req.params.groupId, req.params.iso]);

    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/chat/:groupId ───────────────────────────────────────────────────
router.post('/:groupId', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    const db = await getDb();
    if (!await requireMember(db, req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const id = uuidv4();
    await db.run(
      'INSERT INTO messages (id, group_id, user_id, content) VALUES (?,?,?,?)',
      [id, req.params.groupId, req.user.id, content.trim()]
    );

    const msg = await db.get(`
      SELECT m.id, m.content, m.created_at, m.deleted,
             u.id AS user_id, u.name AS user_name, u.avatar_path
      FROM messages m JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `, [id]);

    res.status(201).json(msg);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE /api/chat/:groupId/:messageId ──────────────────────────────────────
// Soft-delete — only the message author can delete their own messages.
router.delete('/:groupId/:messageId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    if (!await requireMember(db, req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [req.params.messageId]);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.user_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });

    await db.run('UPDATE messages SET deleted = 1 WHERE id = ?', [req.params.messageId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
