/**
 * One-time migration: compress existing uploads to WebP and update DB paths.
 *
 * Run from the server/ directory:
 *   node scripts/compress-existing.js
 *
 * Safe to re-run — skips files already ending in .webp.
 * Does NOT delete the original files automatically. Once you've verified
 * everything looks correct, you can clean up originals manually.
 */

require('dotenv').config();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');

const uploadsRoot = path.join(__dirname, '../uploads');

// Targets: [directory, maxWidth]
const DIRS = [
  { dir: path.join(uploadsRoot, 'avatars'),  maxWidth: 400  },
  { dir: path.join(uploadsRoot, 'meals'),    maxWidth: 1200 },
  { dir: path.join(uploadsRoot, 'products'), maxWidth: 1200 },
  { dir: path.join(uploadsRoot, 'receipts'), maxWidth: 1600 },
  // Legacy receipt images in root uploads/
  { dir: uploadsRoot, maxWidth: 1600, rootOnly: true },
];

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

async function compressFile(filePath, maxWidth) {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return null;
  if (ext === '.webp') return null; // already compressed

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ext);
  const outPath = path.join(dir, `${base}.webp`);

  if (fs.existsSync(outPath)) {
    console.log(`  skip (webp exists): ${path.basename(filePath)}`);
    return outPath;
  }

  await sharp(filePath)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outPath);

  const origSize = fs.statSync(filePath).size;
  const newSize  = fs.statSync(outPath).size;
  const pct = Math.round((1 - newSize / origSize) * 100);
  console.log(`  compressed: ${path.basename(filePath)} → ${path.basename(outPath)} (${pct}% smaller)`);

  return outPath;
}

async function updateDbPaths(db) {
  console.log('\nUpdating DB paths...');

  // avatars: stored as "avatars/{filename}" in users.avatar_path
  const users = await db.all("SELECT id, avatar_path FROM users WHERE avatar_path IS NOT NULL AND avatar_path NOT LIKE '%.webp'");
  for (const u of users) {
    const ext = path.extname(u.avatar_path);
    const newPath = u.avatar_path.replace(ext, '.webp');
    const absPath = path.join(uploadsRoot, '..', newPath.replace(/^\//, ''));
    if (fs.existsSync(path.join(uploadsRoot, newPath))) {
      await db.run('UPDATE users SET avatar_path = ? WHERE id = ?', [newPath, u.id]);
      console.log(`  users.avatar_path: ${u.avatar_path} → ${newPath}`);
    }
  }

  // meal_photos: stored as "uploads/meals/{filename}" in meal_photos.image_path
  const photos = await db.all("SELECT id, image_path FROM meal_photos WHERE image_path IS NOT NULL AND image_path NOT LIKE '%.webp'");
  for (const p of photos) {
    const ext = path.extname(p.image_path);
    const newPath = p.image_path.replace(ext, '.webp');
    const absNew = path.join(uploadsRoot, '..', newPath);
    if (fs.existsSync(absNew)) {
      await db.run('UPDATE meal_photos SET image_path = ? WHERE id = ?', [newPath, p.id]);
      console.log(`  meal_photos.image_path: ${p.image_path} → ${newPath}`);
    }
  }

  // products: stored as "uploads/products/{filename}" in products.image_path
  const products = await db.all("SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path NOT LIKE '%.webp'");
  for (const p of products) {
    const ext = path.extname(p.image_path);
    const newPath = p.image_path.replace(ext, '.webp');
    const absNew = path.join(uploadsRoot, '..', newPath);
    if (fs.existsSync(absNew)) {
      await db.run('UPDATE products SET image_path = ? WHERE id = ?', [newPath, p.id]);
      console.log(`  products.image_path: ${p.image_path} → ${newPath}`);
    }
  }

  // receipts: stored as "/uploads/{filename}" or "/uploads/receipts/{filename}"
  const receipts = await db.all("SELECT id, image_path FROM receipts WHERE image_path IS NOT NULL AND image_path NOT LIKE '%.webp'");
  for (const r of receipts) {
    const ext = path.extname(r.image_path);
    const newPath = r.image_path.replace(ext, '.webp');
    const absNew = path.join(uploadsRoot, '..', newPath.replace(/^\//, ''));
    if (fs.existsSync(absNew)) {
      await db.run('UPDATE receipts SET image_path = ? WHERE id = ?', [newPath, r.id]);
      console.log(`  receipts.image_path: ${r.image_path} → ${newPath}`);
    }
  }
}

async function run() {
  console.log('=== compress-existing.js ===\n');

  let total = 0;
  for (const { dir, maxWidth, rootOnly } of DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => {
      if (rootOnly) {
        // Only process loose image files in uploads root, not subdirectory entries
        return fs.statSync(path.join(dir, f)).isFile();
      }
      return true;
    });

    console.log(`\n[${path.relative(uploadsRoot, dir) || 'uploads (root)'}] — ${files.length} files`);
    for (const f of files) {
      const result = await compressFile(path.join(dir, f), maxWidth);
      if (result) total++;
    }
  }

  console.log(`\n${total} file(s) compressed.`);

  const db = await getDb();
  await updateDbPaths(db);

  console.log('\nDone. Originals preserved — delete manually once verified.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
