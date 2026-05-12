const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

async function requireMember(groupId, userId) {
  const db = await getDb();
  return db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
}

// GET /api/equipment/catalog
router.get('/catalog', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { category } = req.query;
    let rows;
    if (category) {
      rows = await db.all('SELECT * FROM equipment_catalog WHERE category = ? ORDER BY is_recommended DESC, name', [category]);
    } else {
      rows = await db.all('SELECT * FROM equipment_catalog ORDER BY category, is_recommended DESC, name');
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/equipment/catalog
router.post('/catalog', authMiddleware, async (req, res) => {
  try {
    const { name, category, brand, description, image_url, purchase_url, is_recommended } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO equipment_catalog (id,name,category,brand,description,image_url,purchase_url,is_recommended) VALUES (?,?,?,?,?,?,?,?)',
      [id, name, category, brand || '', description || '', image_url || '', purchase_url || '', is_recommended ? 1 : 0]
    );
    const created = await db.get('SELECT * FROM equipment_catalog WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/equipment/:groupId/gear
router.get('/:groupId/gear', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT ge.*,
             u.name  AS owner_name,
             ec.name AS catalog_name,
             ec.brand, ec.category, ec.purchase_url
      FROM group_equipment ge
      LEFT JOIN users u             ON u.id  = ge.owner_user_id
      LEFT JOIN equipment_catalog ec ON ec.id = ge.catalog_item_id
      WHERE ge.group_id = ?
      ORDER BY ec.category, ge.custom_name, ec.name
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/equipment/:groupId/gear
router.post('/:groupId/gear', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { catalog_item_id, custom_name, quantity, owner_user_id, condition, notes } = req.body;
    if (!catalog_item_id && !custom_name)
      return res.status(400).json({ error: 'catalog_item_id or custom_name required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO group_equipment (id,group_id,catalog_item_id,custom_name,quantity,owner_user_id,condition,notes) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, catalog_item_id || null, custom_name || null,
       quantity || 1, owner_user_id || null, condition || 'good', notes || '']
    );
    const created = await db.get(`
      SELECT ge.*, u.name AS owner_name, ec.name AS catalog_name, ec.brand, ec.category, ec.purchase_url
      FROM group_equipment ge
      LEFT JOIN users u ON u.id = ge.owner_user_id
      LEFT JOIN equipment_catalog ec ON ec.id = ge.catalog_item_id
      WHERE ge.id = ?
    `, [id]);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/equipment/:groupId/gear/:id
router.put('/:groupId/gear/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const item = await db.get('SELECT * FROM group_equipment WHERE id = ? AND group_id = ?',
      [req.params.id, req.params.groupId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { quantity, owner_user_id, condition, notes } = req.body;
    await db.run(
      'UPDATE group_equipment SET quantity=?, owner_user_id=?, condition=?, notes=? WHERE id=?',
      [quantity !== undefined ? quantity : item.quantity,
       owner_user_id !== undefined ? owner_user_id : item.owner_user_id,
       condition || item.condition, notes !== undefined ? notes : item.notes,
       req.params.id]
    );
    const updated = await db.get(`
      SELECT ge.*, u.name AS owner_name, ec.name AS catalog_name, ec.brand, ec.category, ec.purchase_url
      FROM group_equipment ge
      LEFT JOIN users u ON u.id = ge.owner_user_id
      LEFT JOIN equipment_catalog ec ON ec.id = ge.catalog_item_id
      WHERE ge.id = ?
    `, [req.params.id]);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/equipment/:groupId/gear/:id
router.delete('/:groupId/gear/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM group_equipment WHERE id = ? AND group_id = ?',
      [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/equipment/:groupId/containers
router.get('/:groupId/containers', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const { type } = req.query;
    let rows;
    if (type && type !== 'all') {
      rows = await db.all(
        'SELECT * FROM container_fleet WHERE group_id = ? AND supply_type = ? ORDER BY created_at',
        [req.params.groupId, type]
      );
    } else {
      rows = await db.all(
        'SELECT * FROM container_fleet WHERE group_id = ? ORDER BY supply_type, created_at',
        [req.params.groupId]
      );
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/equipment/:groupId/containers
router.post('/:groupId/containers', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { container_type, size_capacity, material, description, purchase_url, supply_type } = req.body;
    if (!container_type) return res.status(400).json({ error: 'container_type required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO container_fleet (id,group_id,container_type,size_capacity,material,description,purchase_url,supply_type) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, container_type, size_capacity || '', material || '',
       description || '', purchase_url || '', supply_type || 'container']
    );
    const created = await db.get('SELECT * FROM container_fleet WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/equipment/:groupId/containers/:id
router.put('/:groupId/containers/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const c = await db.get('SELECT * FROM container_fleet WHERE id = ? AND group_id = ?',
      [req.params.id, req.params.groupId]);
    if (!c) return res.status(404).json({ error: 'Container not found' });
    const { container_type, size_capacity, material, description, purchase_url, supply_type } = req.body;
    await db.run(
      'UPDATE container_fleet SET container_type=?, size_capacity=?, material=?, description=?, purchase_url=?, supply_type=? WHERE id=?',
      [container_type || c.container_type, size_capacity !== undefined ? size_capacity : c.size_capacity,
       material !== undefined ? material : c.material,
       description !== undefined ? description : c.description,
       purchase_url !== undefined ? purchase_url : c.purchase_url,
       supply_type || c.supply_type, req.params.id]
    );
    const updated = await db.get('SELECT * FROM container_fleet WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/equipment/:groupId/containers/:id
router.delete('/:groupId/containers/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM container_fleet WHERE id = ? AND group_id = ?',
      [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
