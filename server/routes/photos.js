const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { compressImage } = require('../utils/compressImage');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/meals');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// memoryStorage — buffer handed to compressImage before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// ── GET /api/photos?group_id=&recipe_id=&inventory_item_id=&vacuum_seal_id= ──
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { group_id, recipe_id, inventory_item_id, vacuum_seal_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const db = await getDb();
    const member = await db.get(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Not a group member' });

    let where = 'p.group_id = ?';
    const params = [group_id];
    if (recipe_id)          { where += ' AND p.recipe_id = ?';          params.push(recipe_id); }
    if (inventory_item_id)  { where += ' AND p.inventory_item_id = ?';  params.push(inventory_item_id); }
    if (vacuum_seal_id)     { where += ' AND p.vacuum_seal_id = ?';     params.push(vacuum_seal_id); }

    const rows = await db.all(`
      SELECT p.*, u.name AS user_name, r.title AS recipe_title,
             inv.name AS inventory_item_name,
             vs.item_name AS vacuum_seal_name
      FROM meal_photos p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN recipes r ON r.id = p.recipe_id
      LEFT JOIN inventory_items inv ON inv.id = p.inventory_item_id
      LEFT JOIN vacuum_seal_log vs ON vs.id = p.vacuum_seal_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/photos (multipart) ─────────────────────────────────────────────
router.post('/', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo file required' });

    const { group_id, recipe_id, inventory_item_id, vacuum_seal_id, caption, stage } = req.body;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const db = await getDb();
    const member = await db.get(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Not a group member' });

    const id = uuidv4();
    const mealFilename = await compressImage(req.file.buffer, uploadDir, `${Date.now()}-${id}`, { maxWidth: 1200 });
    const image_path = `uploads/meals/${mealFilename}`;

    await db.run(`
      INSERT INTO meal_photos
        (id, user_id, group_id, recipe_id, inventory_item_id, vacuum_seal_id, image_path, caption, stage)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [
      id, req.user.id, group_id,
      recipe_id         || null,
      inventory_item_id || null,
      vacuum_seal_id    || null,
      image_path,
      caption || '',
      stage   || 'plated',
    ]);

    const created = await db.get(`
      SELECT p.*, u.name AS user_name, r.title AS recipe_title,
             inv.name AS inventory_item_name,
             vs.item_name AS vacuum_seal_name
      FROM meal_photos p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN recipes r ON r.id = p.recipe_id
      LEFT JOIN inventory_items inv ON inv.id = p.inventory_item_id
      LEFT JOIN vacuum_seal_log vs ON vs.id = p.vacuum_seal_id
      WHERE p.id = ?
    `, [id]);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── PATCH /api/photos/:id (update caption) ───────────────────────────────────
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const photo = await db.get('SELECT * FROM meal_photos WHERE id = ?', [req.params.id]);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.user_id !== req.user.id) return res.status(403).json({ error: 'Not your photo' });
    const { caption } = req.body;
    await db.run('UPDATE meal_photos SET caption = ? WHERE id = ?', [caption ?? photo.caption, req.params.id]);
    res.json({ ...photo, caption: caption ?? photo.caption });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE /api/photos/:id ───────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const photo = await db.get('SELECT * FROM meal_photos WHERE id = ?', [req.params.id]);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.user_id !== req.user.id) return res.status(403).json({ error: 'Not your photo' });

    const filePath = path.join(__dirname, '..', photo.image_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM meal_photos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
