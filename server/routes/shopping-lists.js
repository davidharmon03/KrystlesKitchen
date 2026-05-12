const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const requireAuth = authMiddleware;

async function requireMember(req, res, groupId, next) {
  const db = await getDb();
  const member = await db.get(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, req.user.id]
  );
  if (!member) return res.status(403).json({ error: 'Not a member of this group' });
  return next();
}

const router = express.Router();

// ── GET /api/shopping-lists?group_id= ────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });
  await requireMember(req, res, group_id, async () => {
    const db = await getDb();
    const lists = await db.all(
      `SELECT sl.*,
         (SELECT COUNT(*) FROM shopping_list_items WHERE list_id = sl.id) as item_count,
         (SELECT COUNT(*) FROM shopping_list_items WHERE list_id = sl.id AND is_checked = 1) as checked_count
       FROM shopping_lists sl
       WHERE sl.group_id = ? AND sl.completed_at IS NULL
       ORDER BY sl.created_at DESC`,
      [group_id]
    );
    res.json(lists);
  });
});

// ── POST /api/shopping-lists ──────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { group_id, name } = req.body;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });
  await requireMember(req, res, group_id, async () => {
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO shopping_lists (id, group_id, name) VALUES (?, ?, ?)',
      [id, group_id, name || 'Weekly Shop']
    );
    const row = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [id]);
    res.status(201).json(row);
  });
});

// ── GET /api/shopping-lists/:id/items ─────────────────────────────────────────
router.get('/:id/items', requireAuth, async (req, res) => {
  const db = await getDb();
  const list = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
  if (!list) return res.status(404).json({ error: 'List not found' });

  await requireMember(req, res, list.group_id, async () => {
    const items = await db.all(
      `SELECT sli.*,
         p.name as product_name, p.brand as product_brand,
         p.image_url as product_image_url, p.image_path as product_image_path,
         p.category as product_category, p.unit_type as product_unit_type,
         u.name as added_by_name
       FROM shopping_list_items sli
       LEFT JOIN products p ON p.id = sli.product_id
       LEFT JOIN users u ON u.id = sli.added_by
       WHERE sli.list_id = ?
       ORDER BY sli.is_checked ASC, sli.store_section ASC, sli.created_at ASC`,
      [req.params.id]
    );
    res.json(items);
  });
});

// ── POST /api/shopping-lists/:id/items ────────────────────────────────────────
router.post('/:id/items', requireAuth, async (req, res) => {
  const db = await getDb();
  const list = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
  if (!list) return res.status(404).json({ error: 'List not found' });

  await requireMember(req, res, list.group_id, async () => {
    const { name, product_id, quantity, unit, store_section, category } = req.body;
    if (!name && !product_id) return res.status(400).json({ error: 'name or product_id required' });

    // Resolve name/section from product if product_id provided
    let resolvedName = name;
    let resolvedSection = store_section;
    let resolvedCategory = category;

    if (product_id) {
      const prod = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
      if (prod) {
        resolvedName     = resolvedName || prod.name;
        resolvedSection  = resolvedSection || prod.store_section;
        resolvedCategory = resolvedCategory || prod.category;
      }
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO shopping_list_items
         (id, group_id, list_id, name, product_id, quantity, unit, store_section, category, is_checked, added_by)
       VALUES (?,?,?,?,?,?,?,?,?,0,?)`,
      [id, list.group_id, list.id, resolvedName, product_id || null,
       quantity || '', unit || '', resolvedSection || 'other',
       resolvedCategory || 'other', req.user.id]
    );

    const item = await db.get(
      `SELECT sli.*, p.image_url as product_image_url, p.image_path as product_image_path,
         p.brand as product_brand
       FROM shopping_list_items sli
       LEFT JOIN products p ON p.id = sli.product_id
       WHERE sli.id = ?`, [id]
    );
    res.status(201).json(item);
  });
});

// ── PUT /api/shopping-lists/:id/items/:itemId ─────────────────────────────────
router.put('/:id/items/:itemId', requireAuth, async (req, res) => {
  const db = await getDb();
  const list = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
  if (!list) return res.status(404).json({ error: 'List not found' });

  await requireMember(req, res, list.group_id, async () => {
    const { is_checked, quantity, unit, name, store_section } = req.body;
    const updates = [];
    const vals    = [];

    if (is_checked !== undefined) { updates.push('is_checked = ?'); vals.push(is_checked ? 1 : 0); }
    if (quantity    !== undefined) { updates.push('quantity = ?');   vals.push(quantity); }
    if (unit        !== undefined) { updates.push('unit = ?');       vals.push(unit); }
    if (name        !== undefined) { updates.push('name = ?');       vals.push(name); }
    if (store_section !== undefined) { updates.push('store_section = ?'); vals.push(store_section); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.itemId);

    await db.run(`UPDATE shopping_list_items SET ${updates.join(', ')} WHERE id = ?`, vals);
    const item = await db.get(
      `SELECT sli.*, p.image_url as product_image_url, p.image_path as product_image_path, p.brand as product_brand
       FROM shopping_list_items sli LEFT JOIN products p ON p.id = sli.product_id
       WHERE sli.id = ?`, [req.params.itemId]
    );
    res.json(item);
  });
});

// ── DELETE /api/shopping-lists/:id/items/:itemId ──────────────────────────────
router.delete('/:id/items/:itemId', requireAuth, async (req, res) => {
  const db = await getDb();
  const list = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
  if (!list) return res.status(404).json({ error: 'List not found' });

  await requireMember(req, res, list.group_id, async () => {
    await db.run('DELETE FROM shopping_list_items WHERE id = ? AND list_id = ?',
      [req.params.itemId, req.params.id]);
    res.json({ ok: true });
  });
});

// ── DELETE /api/shopping-lists/:id/items (clear checked) ─────────────────────
router.delete('/:id/items', requireAuth, async (req, res) => {
  const db = await getDb();
  const list = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
  if (!list) return res.status(404).json({ error: 'List not found' });

  await requireMember(req, res, list.group_id, async () => {
    await db.run('DELETE FROM shopping_list_items WHERE list_id = ? AND is_checked = 1', [req.params.id]);
    res.json({ ok: true });
  });
});

// ── PUT /api/shopping-lists/:id/complete ──────────────────────────────────────
router.put('/:id/complete', requireAuth, async (req, res) => {
  const db = await getDb();
  const list = await db.get('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
  if (!list) return res.status(404).json({ error: 'List not found' });

  await requireMember(req, res, list.group_id, async () => {
    await db.run(
      "UPDATE shopping_lists SET completed_at = datetime('now') WHERE id = ?",
      [req.params.id]
    );
    res.json({ ok: true });
  });
});

module.exports = router;
