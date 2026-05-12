const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('./notifications');

// ── helpers ────────────────────────────────────────────────────────────────

async function isGroupAdmin(db, groupId, userId) {
  const group = await db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId]);
  return !!(group && group.owner_id === userId);
}

const MENU_RECIPE_COLS = `
  mi.id, mi.recipe_id, mi.group_id, mi.available, mi.price, mi.note, mi.created_at,
  r.title, r.description, r.sides, r.tags, r.skill_tags,
  (SELECT image_path FROM meal_photos WHERE recipe_id = r.id ORDER BY created_at DESC LIMIT 1) AS image_path
`;

// ── MENU ───────────────────────────────────────────────────────────────────

// GET /api/orders/menu/:groupId  —  any auth'd user; returns available=1 only
router.get('/menu/:groupId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const items = await db.all(`
      SELECT ${MENU_RECIPE_COLS}
      FROM menu_items mi
      JOIN recipes r ON r.id = mi.recipe_id
      WHERE mi.group_id = ? AND mi.available = 1
      ORDER BY mi.created_at DESC
    `, [req.params.groupId]);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/menu/:groupId/all  —  admin only; includes hidden items
router.get('/menu/:groupId/all', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    if (!await isGroupAdmin(db, req.params.groupId, req.user.id)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const items = await db.all(`
      SELECT ${MENU_RECIPE_COLS}
      FROM menu_items mi
      JOIN recipes r ON r.id = mi.recipe_id
      WHERE mi.group_id = ?
      ORDER BY mi.created_at DESC
    `, [req.params.groupId]);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders/menu  —  admin only; adds a recipe to the menu
router.post('/menu', authMiddleware, async (req, res) => {
  try {
    const { recipe_id, group_id, price = '', note = '' } = req.body;
    if (!recipe_id || !group_id) {
      return res.status(400).json({ error: 'recipe_id and group_id required' });
    }
    const db = await getDb();
    if (!await isGroupAdmin(db, group_id, req.user.id)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const id = uuidv4();
    await db.run(
      'INSERT INTO menu_items (id, recipe_id, group_id, price, note) VALUES (?, ?, ?, ?, ?)',
      [id, recipe_id, group_id, price, note]
    );
    const item = await db.get(`
      SELECT ${MENU_RECIPE_COLS}
      FROM menu_items mi
      JOIN recipes r ON r.id = mi.recipe_id
      WHERE mi.id = ?
    `, [id]);
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/menu/:id  —  admin only; toggle available, update price/note
router.put('/menu/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!await isGroupAdmin(db, item.group_id, req.user.id)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const available = req.body.available !== undefined ? req.body.available : item.available;
    const price     = req.body.price     !== undefined ? req.body.price     : item.price;
    const note      = req.body.note      !== undefined ? req.body.note      : item.note;
    await db.run(
      'UPDATE menu_items SET available = ?, price = ?, note = ? WHERE id = ?',
      [available, price, note, req.params.id]
    );
    const updated = await db.get(`
      SELECT ${MENU_RECIPE_COLS}
      FROM menu_items mi
      JOIN recipes r ON r.id = mi.recipe_id
      WHERE mi.id = ?
    `, [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orders/menu/:id  —  admin only
router.delete('/menu/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!await isGroupAdmin(db, item.group_id, req.user.id)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    await db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── REQUESTS ───────────────────────────────────────────────────────────────

// GET /api/orders/requests/:groupId  —  admin only; all requests
router.get('/requests/:groupId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    if (!await isGroupAdmin(db, req.params.groupId, req.user.id)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const rows = await db.all(`
      SELECT mr.id, mr.menu_item_id, mr.group_id, mr.requester_id,
             mr.quantity, mr.note, mr.status, mr.requested_at, mr.updated_at,
             u.name  AS requester_name,
             r.title AS recipe_title
      FROM meal_requests mr
      JOIN users u       ON u.id  = mr.requester_id
      JOIN menu_items mi ON mi.id = mr.menu_item_id
      JOIN recipes r     ON r.id  = mi.recipe_id
      WHERE mr.group_id = ?
      ORDER BY mr.requested_at DESC
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/requests/:groupId/mine  —  own requests for current user
router.get('/requests/:groupId/mine', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(`
      SELECT mr.id, mr.menu_item_id, mr.group_id, mr.requester_id,
             mr.quantity, mr.note, mr.status, mr.requested_at, mr.updated_at,
             r.title AS recipe_title
      FROM meal_requests mr
      JOIN menu_items mi ON mi.id = mr.menu_item_id
      JOIN recipes r     ON r.id  = mi.recipe_id
      WHERE mr.group_id = ? AND mr.requester_id = ?
      ORDER BY mr.requested_at DESC
    `, [req.params.groupId, req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders/requests  —  any auth'd user submits a request
router.post('/requests', authMiddleware, async (req, res) => {
  try {
    const { menu_item_id, group_id, quantity = 1, note = '' } = req.body;
    if (!menu_item_id || !group_id) {
      return res.status(400).json({ error: 'menu_item_id and group_id required' });
    }
    const db = await getDb();

    const menuItem = await db.get(
      'SELECT * FROM menu_items WHERE id = ? AND available = 1',
      [menu_item_id]
    );
    if (!menuItem) return res.status(404).json({ error: 'Menu item not available' });

    const id = uuidv4();
    await db.run(
      'INSERT INTO meal_requests (id, menu_item_id, group_id, requester_id, quantity, note) VALUES (?, ?, ?, ?, ?, ?)',
      [id, menu_item_id, group_id, req.user.id, quantity, note]
    );

    // Notify group admin
    const group     = await db.get('SELECT owner_id FROM groups WHERE id = ?', [group_id]);
    const recipe    = await db.get('SELECT title FROM recipes WHERE id = ?', [menuItem.recipe_id]);
    const requester = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    if (group && group.owner_id !== req.user.id) {
      await createNotification({
        user_id:  group.owner_id,
        group_id,
        type:     'order_request',
        title:    'New meal request',
        message:  `New meal request from ${requester?.name || 'Someone'}: ${recipe?.title || 'Unknown'} ×${quantity}`,
        link:     '/orders',
      });
    }

    const created = await db.get('SELECT * FROM meal_requests WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/requests/:id/status  —  admin only; advance status
router.put('/requests/:id/status', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const request = await db.get('SELECT * FROM meal_requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Not found' });
    if (!await isGroupAdmin(db, request.group_id, req.user.id)) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { status } = req.body;
    const valid = ['pending', 'accepted', 'ready', 'picked_up', 'declined'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }

    await db.run(
      "UPDATE meal_requests SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, req.params.id]
    );

    // Notify requester on key status changes
    const menuItem    = await db.get('SELECT recipe_id FROM menu_items WHERE id = ?', [request.menu_item_id]);
    const recipe      = menuItem ? await db.get('SELECT title FROM recipes WHERE id = ?', [menuItem.recipe_id]) : null;
    const recipeTitle = recipe?.title || 'Your meal';

    if (status === 'ready') {
      await createNotification({
        user_id:  request.requester_id,
        group_id: request.group_id,
        type:     'order_ready',
        title:    'Meal ready for pickup!',
        message:  `Your ${recipeTitle} request is ready for pickup!`,
        link:     '/orders',
      });
    } else if (status === 'declined') {
      await createNotification({
        user_id:  request.requester_id,
        group_id: request.group_id,
        type:     'order_declined',
        title:    'Meal request declined',
        message:  `Your ${recipeTitle} request was declined.`,
        link:     '/orders',
      });
    }

    const updated = await db.get('SELECT * FROM meal_requests WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
