const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_NOTIFICATION_PREFS } = require('./auth');

// Maps notification type → notification_prefs key.
// Types not listed here are always delivered (e.g. invite_received).
const TYPE_TO_PREF = {
  swap_week_created: 'in_app_swap',
  entree_ready:      'in_app_swap',
  order_request:     'in_app_orders',
  order_ready:       'in_app_orders',
  order_declined:    'in_app_orders',
  harvest_logged:    'in_app_kultivate',
  meal_added:        'in_app_kuzine',
  bulk_buy_posted:   'in_app_korner',
};

async function getUserPrefs(db, userId) {
  const row = await db.get('SELECT notification_prefs FROM users WHERE id = ?', [userId]);
  let parsed = {};
  try { parsed = JSON.parse(row?.notification_prefs || '{}'); } catch {}
  return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
}

// Internal helper — called by other routes, not a public endpoint.
// Respects the user's notification_prefs before inserting.
async function createNotification({ user_id, group_id, type, title, message, link }) {
  try {
    const db = await getDb();

    // Check preference for this notification type
    const prefKey = TYPE_TO_PREF[type];
    if (prefKey) {
      const prefs = await getUserPrefs(db, user_id);
      if (prefs[prefKey] === false) return; // user opted out
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO notifications (id, user_id, group_id, type, title, message, link)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, group_id || null, type, title, message || '', link || null]
    );
    return id;
  } catch (err) {
    console.error('createNotification error:', err);
  }
}

// Notify all members of a group except the actor.
// Each member's preferences are checked individually.
async function notifyGroupMembers({ group_id, exclude_user_id, type, title, message, link }) {
  try {
    const db = await getDb();
    const members = await db.all(
      'SELECT user_id FROM group_members WHERE group_id = ?',
      [group_id]
    );
    for (const m of members) {
      if (m.user_id === exclude_user_id) continue;
      await createNotification({ user_id: m.user_id, group_id, type, title, message, link });
    }
  } catch (err) {
    console.error('notifyGroupMembers error:', err);
  }
}

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();
    // Return all unread + last 20 read, most recent first
    const rows = await db.all(`
      SELECT * FROM (
        SELECT * FROM notifications WHERE user_id = ? AND is_read = 0
        UNION ALL
        SELECT * FROM (
          SELECT * FROM notifications WHERE user_id = ? AND is_read = 1
          ORDER BY created_at DESC LIMIT 20
        )
      )
      ORDER BY created_at DESC
    `, [userId, userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.notifyGroupMembers = notifyGroupMembers;
