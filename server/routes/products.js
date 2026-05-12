const express = require('express');
const path    = require('path');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const requireAuth = authMiddleware;
const { compressImage } = require('../utils/compressImage');

const router = express.Router();

const productDir = path.join(__dirname, '../uploads/products');

// memoryStorage — buffer handed to compressImage before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function offToProduct(item) {
  const p = item.product || item;
  return {
    id:           null,
    off_id:       p._id || p.id || p.code || null,
    name:         p.product_name_en || p.product_name || p.abbreviated_product_name || '(no name)',
    brand:        p.brands || '',
    category:     mapOffCategory(p.categories_tags),
    store_section: mapOffCategory(p.categories_tags),
    unit_type:    p.quantity ? p.quantity.replace(/[0-9\s.]+/, '').trim() : '',
    unit_size:    p.quantity || '',
    description:  p.generic_name_en || p.generic_name || '',
    image_url:    p.image_front_small_url || p.image_front_url || p.image_url || '',
    barcode:      p.code || p._id || '',
    source:       'open_food_facts',
  };
}

function mapOffCategory(tags) {
  if (!tags || !tags.length) return 'other';
  const t = tags.join(' ');
  if (/produce|vegetable|fruit|fresh/.test(t))   return 'produce';
  if (/meat|seafood|fish|poultry|beef/.test(t))   return 'meat_seafood';
  if (/dairy|milk|cheese|egg|butter/.test(t))     return 'dairy_eggs';
  if (/frozen/.test(t))                           return 'frozen';
  if (/beverage|drink|juice|water|soda/.test(t))  return 'beverages';
  if (/bakery|bread|pastry/.test(t))              return 'bakery';
  if (/snack|chip|crisp|candy/.test(t))           return 'snacks';
  if (/household|cleaning|paper/.test(t))         return 'household';
  return 'pantry';
}

// ── GET /api/products/search?q=&group_id= ────────────────────────────────────
router.get('/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const db = await getDb();

  // Local catalog search
  const local = await db.all(
    `SELECT * FROM products WHERE name LIKE ? OR brand LIKE ? ORDER BY name LIMIT 10`,
    [`%${q}%`, `%${q}%`]
  );

  // Open Food Facts search
  let offResults = [];
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=_id,code,product_name,product_name_en,abbreviated_product_name,brands,categories_tags,quantity,image_front_small_url,image_front_url,generic_name_en`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const data = await resp.json();
      const products = (data.products || []).filter(p => p.product_name || p.product_name_en);
      // Exclude items already in local by barcode
      const localBarcodes = new Set(local.map(p => p.barcode).filter(Boolean));
      offResults = products
        .filter(p => !(p.code && localBarcodes.has(p.code)))
        .slice(0, 10)
        .map(offToProduct);
    }
  } catch (e) {
    // OFF is optional — don't fail if network is unavailable
    console.warn('OFF search failed:', e.message);
  }

  // Local results first, marked as source=custom; OFF results after
  const combined = [
    ...local.map(p => ({ ...p, source: p.source || 'custom' })),
    ...offResults,
  ];

  res.json(combined.slice(0, 15));
});

// ── GET /api/products/barcode/:barcode ───────────────────────────────────────
router.get('/barcode/:barcode', requireAuth, async (req, res) => {
  const { barcode } = req.params;
  const db = await getDb();

  // Check local first
  const local = await db.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
  if (local) return res.json(local);

  // Open Food Facts barcode lookup
  try {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      signal: AbortSignal.timeout(5000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 1 && data.product) {
        return res.json(offToProduct(data));
      }
    }
    res.status(404).json({ error: 'Product not found' });
  } catch (e) {
    res.status(503).json({ error: 'Barcode lookup unavailable' });
  }
});

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const db = await getDb();
  const { category } = req.query;
  let rows;
  if (category) {
    rows = await db.all('SELECT * FROM products WHERE category = ? ORDER BY name', [category]);
  } else {
    rows = await db.all('SELECT * FROM products ORDER BY name');
  }
  res.json(rows);
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const db = await getDb();
  const row = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ── POST /api/products ────────────────────────────────────────────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  const db = await getDb();
  const {
    name, brand, category, store_section, unit_type, unit_size,
    description, image_url, barcode, source, off_id, is_public,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const id         = uuidv4();
  let image_path = null;
  if (req.file) {
    const filename = await compressImage(req.file.buffer, productDir, uuidv4(), { maxWidth: 1200 });
    image_path = `uploads/products/${filename}`;
  }
  const finalImgUrl = image_path ? null : (image_url || null);

  await db.run(
    `INSERT INTO products
      (id, name, brand, category, store_section, unit_type, unit_size, description,
       image_url, image_path, barcode, source, off_id, created_by_user_id, is_public)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, name, brand || '', category || 'other', store_section || 'pantry',
     unit_type || '', unit_size || '', description || '',
     finalImgUrl, image_path, barcode || null,
     source || 'custom', off_id || null, req.user.id, is_public ? 1 : 1]
  );

  const row = await db.get('SELECT * FROM products WHERE id = ?', [id]);
  res.status(201).json(row);
});

module.exports = router;
