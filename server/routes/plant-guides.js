const express = require('express');
const router  = express.Router();
const { getDb } = require('../db');

function parseGuide(g) {
  if (!g) return null;
  const tryJ = (s, fb) => { try { return JSON.parse(s) } catch { return fb } };
  return {
    ...g,
    planting_seasons:      tryJ(g.planting_seasons, []),
    companion_plants:      tryJ(g.companion_plants, []),
    avoid_planting_with:   tryJ(g.avoid_planting_with, []),
    resource_links:        tryJ(g.resource_links, []),
  };
}

// GET /api/plant-guides/search?q=   ← must come before /:id
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const db = await getDb();
    const rows = await db.all(
      `SELECT id, common_name, scientific_name, type, days_to_harvest, sunlight, space_needed_sqft
       FROM plant_guides
       WHERE common_name LIKE ? OR scientific_name LIKE ?
       ORDER BY common_name LIMIT 10`,
      [`%${q}%`, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plant-guides?type=herb
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { type } = req.query;
    let rows;
    if (type && type !== 'all') {
      rows = await db.all(
        'SELECT * FROM plant_guides WHERE type = ? ORDER BY common_name',
        [type]
      );
    } else {
      rows = await db.all('SELECT * FROM plant_guides ORDER BY common_name');
    }
    res.json(rows.map(parseGuide));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plant-guides/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT * FROM plant_guides WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Guide not found' });
    res.json(parseGuide(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
