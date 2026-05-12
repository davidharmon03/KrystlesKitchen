const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { notifyGroupMembers } = require('./notifications');

async function requireMember(groupId, userId) {
  const db = await getDb();
  return db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
}

function calcUseBy(dateStr, storageType) {
  if (!dateStr) return null;
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  if (isNaN(d.getTime())) return null;
  switch (storageType) {
    case 'fresh':         d.setDate(d.getDate() + 5);    break;
    case 'vacuum sealed': d.setDate(d.getDate() + 14);   break;
    case 'frozen':        d.setDate(d.getDate() + 90);   break;
    case 'canned':
    case 'dry storage':   d.setDate(d.getDate() + 180);  break;
    case 'vacuum-frozen': d.setMonth(d.getMonth() + 12); break;
    default:              d.setDate(d.getDate() + 14);   break;
  }
  return d.toISOString().split('T')[0];
}

// GET /:groupId/inventory
router.get('/:groupId/inventory', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT i.*, u.name AS added_by_name,
        (SELECT image_path FROM meal_photos WHERE inventory_item_id = i.id ORDER BY created_at ASC LIMIT 1) AS meal_photo_path
      FROM inventory_items i JOIN users u ON u.id = i.added_by
      WHERE i.group_id = ?
      ORDER BY i.category, i.name
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/inventory
router.post('/:groupId/inventory', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { name, item_name, quantity, category, storage_type, notes, use_by_date, product_id, product_image_url } = req.body;
    const itemName = name || item_name;
    if (!itemName || !quantity || !category || !storage_type)
      return res.status(400).json({ error: 'name, quantity, category, storage_type required' });
    const db = await getDb();
    const id = uuidv4();
    const today = new Date().toISOString().split('T')[0];
    const computed_use_by = use_by_date || calcUseBy(today, storage_type);
    await db.run(
      'INSERT INTO inventory_items (id, group_id, name, quantity, category, storage_type, notes, use_by_date, product_id, product_image_url, added_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, itemName, quantity, category, storage_type, notes || '', computed_use_by, product_id || null, product_image_url || null, req.user.id]
    );
    const created = await db.get(
      'SELECT i.*, u.name AS added_by_name FROM inventory_items i JOIN users u ON u.id = i.added_by WHERE i.id = ?',
      [id]
    );
    // Notify group members
    notifyGroupMembers({
      group_id: req.params.groupId,
      exclude_user_id: req.user.id,
      type: 'meal_added',
      title: 'New inventory item added',
      message: `${created.added_by_name} added "${itemName}" to the group inventory.`,
      link: '/kuzine'
    });
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /:groupId/inventory/:id
router.put('/:groupId/inventory/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const item = await db.get('SELECT * FROM inventory_items WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { name, quantity, category, storage_type, notes } = req.body;
    await db.run(
      'UPDATE inventory_items SET name=?, quantity=?, category=?, storage_type=?, notes=? WHERE id=?',
      [name ?? item.name, quantity ?? item.quantity, category ?? item.category, storage_type ?? item.storage_type, notes ?? item.notes, req.params.id]
    );
    const updated = await db.get(
      'SELECT i.*, u.name AS added_by_name FROM inventory_items i JOIN users u ON u.id = i.added_by WHERE i.id = ?',
      [req.params.id]
    );
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/inventory/:id
router.delete('/:groupId/inventory/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM inventory_items WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/shopping
router.get('/:groupId/shopping', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT s.*, u.name AS added_by_name
      FROM shopping_list_items s JOIN users u ON u.id = s.added_by
      WHERE s.group_id = ?
      ORDER BY s.is_checked, s.category, s.name
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/shopping
router.post('/:groupId/shopping', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { name, quantity, category } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO shopping_list_items (id, group_id, name, quantity, category, added_by) VALUES (?,?,?,?,?,?)',
      [id, req.params.groupId, name, quantity || '', category || '', req.user.id]
    );
    const created = await db.get(
      'SELECT s.*, u.name AS added_by_name FROM shopping_list_items s JOIN users u ON u.id = s.added_by WHERE s.id = ?',
      [id]
    );
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /:groupId/shopping/:id/toggle
router.patch('/:groupId/shopping/:id/toggle', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const item = await db.get('SELECT * FROM shopping_list_items WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await db.run('UPDATE shopping_list_items SET is_checked = ? WHERE id = ?', [item.is_checked ? 0 : 1, req.params.id]);
    res.json({ ...item, is_checked: item.is_checked ? 0 : 1 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/shopping/:id
router.delete('/:groupId/shopping/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM shopping_list_items WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/shopping (clear checked)
router.delete('/:groupId/shopping', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM shopping_list_items WHERE group_id = ? AND is_checked = 1', [req.params.groupId]);
    res.json({ message: 'Checked items cleared' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/vacuum-log
router.get('/:groupId/vacuum-log', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT v.*, u.name AS added_by_name,
        (SELECT image_path FROM meal_photos WHERE vacuum_seal_id = v.id ORDER BY created_at ASC LIMIT 1) AS meal_photo_path
      FROM vacuum_seal_log v JOIN users u ON u.id = v.added_by
      WHERE v.group_id = ?
      ORDER BY v.seal_date DESC
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/vacuum-log
router.post('/:groupId/vacuum-log', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { item_name, quantity, seal_date, expiry_date, storage_location, notes, use_by_date, product_id, product_image_url } = req.body;
    if (!item_name || !seal_date)
      return res.status(400).json({ error: 'item_name and seal_date required' });
    const db = await getDb();
    const id = uuidv4();
    const computed_use_by = use_by_date || expiry_date || calcUseBy(seal_date, 'vacuum-frozen');
    await db.run(
      'INSERT INTO vacuum_seal_log (id, group_id, item_name, quantity, seal_date, expiry_date, use_by_date, storage_location, notes, product_id, product_image_url, added_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, item_name, quantity || '', seal_date, expiry_date || '', computed_use_by, storage_location || '', notes || '', product_id || null, product_image_url || null, req.user.id]
    );
    const created = await db.get(
      'SELECT v.*, u.name AS added_by_name FROM vacuum_seal_log v JOIN users u ON u.id = v.added_by WHERE v.id = ?',
      [id]
    );
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/vacuum-log/:id
router.delete('/:groupId/vacuum-log/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM vacuum_seal_log WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Bulk Buy Runs ──────────────────────────────────────────────────────────

// GET /:groupId/bulk-buys
router.get('/:groupId/bulk-buys', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT r.*, u.name AS buyer_name, c.name AS created_by_name,
             (SELECT COUNT(*) FROM bulk_buy_items WHERE run_id = r.id) AS item_count
      FROM bulk_buy_runs r
      LEFT JOIN users u ON u.id = r.buyer_user_id
      LEFT JOIN users c ON c.id = r.created_by
      WHERE r.group_id = ?
      ORDER BY r.run_date DESC, r.created_at DESC
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/bulk-buys
router.post('/:groupId/bulk-buys', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { name, run_date, buyer_user_id } = req.body;
    if (!name || !run_date) return res.status(400).json({ error: 'name and run_date required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO bulk_buy_runs (id, group_id, name, run_date, buyer_user_id, status, created_by) VALUES (?,?,?,?,?,?,?)',
      [id, req.params.groupId, name, run_date, buyer_user_id || null, 'planning', req.user.id]
    );
    const created = await db.get(`
      SELECT r.*, u.name AS buyer_name, c.name AS created_by_name, 0 AS item_count
      FROM bulk_buy_runs r
      LEFT JOIN users u ON u.id = r.buyer_user_id
      LEFT JOIN users c ON c.id = r.created_by
      WHERE r.id = ?
    `, [id]);
    // Notify group members
    notifyGroupMembers({
      group_id: req.params.groupId,
      exclude_user_id: req.user.id,
      type: 'bulk_buy_posted',
      title: 'New bulk buy run posted',
      message: `${created.created_by_name} created a new bulk buy run: "${name}" on ${run_date}.`,
      link: '/kuzine'
    });
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /:groupId/bulk-buys/:runId
router.put('/:groupId/bulk-buys/:runId', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const run = await db.get('SELECT * FROM bulk_buy_runs WHERE id = ? AND group_id = ?',
      [req.params.runId, req.params.groupId]);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    const { name, run_date, buyer_user_id, status } = req.body;
    await db.run(
      'UPDATE bulk_buy_runs SET name=?, run_date=?, buyer_user_id=?, status=? WHERE id=?',
      [name ?? run.name, run_date ?? run.run_date,
       buyer_user_id !== undefined ? buyer_user_id : run.buyer_user_id,
       status ?? run.status, req.params.runId]
    );
    const updated = await db.get(`
      SELECT r.*, u.name AS buyer_name, c.name AS created_by_name,
             (SELECT COUNT(*) FROM bulk_buy_items WHERE run_id = r.id) AS item_count
      FROM bulk_buy_runs r
      LEFT JOIN users u ON u.id = r.buyer_user_id
      LEFT JOIN users c ON c.id = r.created_by
      WHERE r.id = ?
    `, [req.params.runId]);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/bulk-buys/:runId
router.delete('/:groupId/bulk-buys/:runId', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM bulk_buy_items WHERE run_id = ?', [req.params.runId]);
    await db.run('DELETE FROM bulk_buy_runs WHERE id = ? AND group_id = ?',
      [req.params.runId, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/bulk-buys/:runId/items
router.get('/:groupId/bulk-buys/:runId/items', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT i.*, u.name AS requested_by_name
      FROM bulk_buy_items i
      LEFT JOIN users u ON u.id = i.requested_by
      WHERE i.run_id = ? AND i.group_id = ?
      ORDER BY i.category, i.item_name
    `, [req.params.runId, req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/bulk-buys/:runId/items
router.post('/:groupId/bulk-buys/:runId/items', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { item_name, category, quantity_needed, est_cost, notes } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO bulk_buy_items (id, run_id, group_id, item_name, category, requested_by, quantity_needed, est_cost, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, req.params.runId, req.params.groupId, item_name,
       category || 'other', req.user.id,
       quantity_needed || '', est_cost || null, notes || '']
    );
    const created = await db.get(`
      SELECT i.*, u.name AS requested_by_name
      FROM bulk_buy_items i LEFT JOIN users u ON u.id = i.requested_by
      WHERE i.id = ?
    `, [id]);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /:groupId/bulk-buys/:runId/items/:itemId
router.put('/:groupId/bulk-buys/:runId/items/:itemId', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const item = await db.get('SELECT * FROM bulk_buy_items WHERE id = ? AND run_id = ?',
      [req.params.itemId, req.params.runId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { item_name, category, quantity_needed, est_cost, actual_cost, notes } = req.body;
    await db.run(
      'UPDATE bulk_buy_items SET item_name=?, category=?, quantity_needed=?, est_cost=?, actual_cost=?, notes=? WHERE id=?',
      [item_name ?? item.item_name, category ?? item.category,
       quantity_needed ?? item.quantity_needed,
       est_cost !== undefined ? est_cost : item.est_cost,
       actual_cost !== undefined ? actual_cost : item.actual_cost,
       notes ?? item.notes, req.params.itemId]
    );
    const updated = await db.get(`
      SELECT i.*, u.name AS requested_by_name
      FROM bulk_buy_items i LEFT JOIN users u ON u.id = i.requested_by
      WHERE i.id = ?
    `, [req.params.itemId]);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/bulk-buys/:runId/items/:itemId
router.delete('/:groupId/bulk-buys/:runId/items/:itemId', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM bulk_buy_items WHERE id = ? AND run_id = ?',
      [req.params.itemId, req.params.runId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/bulk-buys/:runId/settlement
router.get('/:groupId/bulk-buys/:runId/settlement', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const run = await db.get(`
      SELECT r.*, u.name AS buyer_name, u.id AS buyer_id
      FROM bulk_buy_runs r LEFT JOIN users u ON u.id = r.buyer_user_id
      WHERE r.id = ?
    `, [req.params.runId]);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const items = await db.all(`
      SELECT i.*, u.name AS requester_name
      FROM bulk_buy_items i LEFT JOIN users u ON u.id = i.requested_by
      WHERE i.run_id = ? AND i.group_id = ?
    `, [req.params.runId, req.params.groupId]);

    // Group totals by requester
    const totals = {};
    let grandTotal = 0;
    for (const item of items) {
      const cost = item.actual_cost ?? item.est_cost ?? 0;
      const rid = item.requested_by;
      if (!totals[rid]) totals[rid] = { user_id: rid, name: item.requester_name, total: 0 };
      totals[rid].total += cost;
      grandTotal += cost;
    }

    res.json({
      run,
      items,
      settlement: Object.values(totals),
      grand_total: grandTotal,
      buyer_user_id: run.buyer_user_id,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
