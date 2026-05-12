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

// GET /:groupId/plants
router.get('/:groupId/plants', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT p.*, u.name AS added_by_name, g.common_name AS guide_name
      FROM garden_plants p
      JOIN users u ON u.id = p.added_by
      LEFT JOIN plant_guides g ON g.id = p.plant_guide_id
      WHERE p.group_id = ?
      ORDER BY p.date_planted DESC
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/plants
router.post('/:groupId/plants', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { plant_name, date_planted, expected_harvest, status, notes, plant_guide_id } = req.body;
    if (!plant_name || !date_planted)
      return res.status(400).json({ error: 'plant_name and date_planted required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO garden_plants (id, group_id, plant_name, date_planted, expected_harvest, status, notes, added_by, plant_guide_id) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, plant_name, date_planted, expected_harvest || '', status || 'growing', notes || '', req.user.id, plant_guide_id || null]
    );
    const created = await db.get(
      `SELECT p.*, u.name AS added_by_name, g.common_name AS guide_name
       FROM garden_plants p JOIN users u ON u.id = p.added_by
       LEFT JOIN plant_guides g ON g.id = p.plant_guide_id
       WHERE p.id = ?`,
      [id]
    );
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /:groupId/plants/:id
router.put('/:groupId/plants/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const plant = await db.get('SELECT * FROM garden_plants WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    const { plant_name, date_planted, expected_harvest, status, notes, plant_guide_id } = req.body;
    await db.run(
      'UPDATE garden_plants SET plant_name=?, date_planted=?, expected_harvest=?, status=?, notes=?, plant_guide_id=? WHERE id=?',
      [plant_name ?? plant.plant_name, date_planted ?? plant.date_planted, expected_harvest ?? plant.expected_harvest, status ?? plant.status, notes ?? plant.notes, plant_guide_id !== undefined ? plant_guide_id : plant.plant_guide_id, req.params.id]
    );
    const updated = await db.get(
      `SELECT p.*, u.name AS added_by_name, g.common_name AS guide_name
       FROM garden_plants p JOIN users u ON u.id = p.added_by
       LEFT JOIN plant_guides g ON g.id = p.plant_guide_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/plants/:id
router.delete('/:groupId/plants/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM garden_plants WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/harvests
router.get('/:groupId/harvests', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT h.*, u.name AS added_by_name
      FROM harvest_logs h JOIN users u ON u.id = h.added_by
      WHERE h.group_id = ?
      ORDER BY h.harvest_date DESC
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/harvests
router.post('/:groupId/harvests', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { plant_id, plant_name, harvest_date, yield_amount, notes, add_to_inventory, inventory_category, inventory_storage } = req.body;
    if (!plant_name || !harvest_date || !yield_amount)
      return res.status(400).json({ error: 'plant_name, harvest_date, yield_amount required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO harvest_logs (id, group_id, plant_id, plant_name, harvest_date, yield_amount, notes, added_by) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, plant_id || null, plant_name, harvest_date, yield_amount, notes || '', req.user.id]
    );
    if (plant_id) {
      await db.run("UPDATE garden_plants SET status = 'harvested' WHERE id = ?", [plant_id]);
    }
    if (add_to_inventory) {
      await db.run(
        'INSERT INTO inventory_items (id, group_id, name, quantity, category, storage_type, notes, added_by) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), req.params.groupId, plant_name, yield_amount, inventory_category || 'produce', inventory_storage || 'fresh', `From harvest on ${harvest_date}`, req.user.id]
      );
      await db.run('UPDATE harvest_logs SET added_to_inventory = 1 WHERE id = ?', [id]);
    }
    const created = await db.get(
      'SELECT h.*, u.name AS added_by_name FROM harvest_logs h JOIN users u ON u.id = h.added_by WHERE h.id = ?',
      [id]
    );
    // Notify group members
    notifyGroupMembers({
      group_id: req.params.groupId,
      exclude_user_id: req.user.id,
      type: 'harvest_logged',
      title: 'Harvest logged!',
      message: `${created.added_by_name} logged a harvest: ${yield_amount} of ${plant_name}.`,
      link: '/kultivate'
    });
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/calendar
router.get('/:groupId/calendar', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT c.*, u.name AS added_by_name
      FROM seasonal_calendar c JOIN users u ON u.id = c.added_by
      WHERE c.group_id = ?
      ORDER BY c.start_date
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/calendar
router.post('/:groupId/calendar', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { title, event_type, start_date, end_date, description } = req.body;
    if (!title || !event_type || !start_date)
      return res.status(400).json({ error: 'title, event_type, start_date required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO seasonal_calendar (id, group_id, title, event_type, start_date, end_date, description, added_by) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.params.groupId, title, event_type, start_date, end_date || '', description || '', req.user.id]
    );
    const created = await db.get(
      'SELECT c.*, u.name AS added_by_name FROM seasonal_calendar c JOIN users u ON u.id = c.added_by WHERE c.id = ?',
      [id]
    );
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/calendar/:id
router.delete('/:groupId/calendar/:id', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    await db.run('DELETE FROM seasonal_calendar WHERE id = ? AND group_id = ?', [req.params.id, req.params.groupId]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
