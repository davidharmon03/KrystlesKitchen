require('dotenv').config();
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Returns YYYY-MM-DD offset by days/months from a date string
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

// 'expired' | 'expiring' | 'ok'
function expiryStatus(usebyStr) {
  if (!usebyStr) return 'ok';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(usebyStr + 'T00:00:00');
  const diffDays = Math.ceil((exp - today) / 86400000);
  if (diffDays < 0)  return 'expired';
  if (diffDays <= 7) return 'expiring';
  return 'ok';
}

// Is dateStr (YYYY-MM-DD) within year/month?
function inMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
}

// Normalise SQLite datetime to YYYY-MM-DD
function toDate(dt) {
  if (!dt) return null;
  return dt.split('T')[0].split(' ')[0];
}

// GET /api/calendar?group_id=&month=&year=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { group_id, month, year } = req.query;
    if (!group_id || !month || !year)
      return res.status(400).json({ error: 'group_id, month, and year are required' });

    const db = await getDb();
    const isMember = await db.get(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id]
    );
    if (!isMember) return res.status(403).json({ error: 'Not a group member' });

    const m = parseInt(month);
    const y = parseInt(year);
    const nextM = m === 12 ? 1  : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const monthEnd   = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const events = [];

    // ── Inventory items ──────────────────────────────────────────────────────
    const invItems = await db.all(
      'SELECT i.*, u.name AS added_by_name FROM inventory_items i JOIN users u ON u.id = i.added_by WHERE i.group_id = ?',
      [group_id]
    );

    for (const item of invItems) {
      const createdDate = toDate(item.created_at);
      const useby = item.use_by_date || calcUseBy(createdDate, item.storage_type);

      // Created event
      if (createdDate && inMonth(createdDate, y, m)) {
        events.push({
          id: `inv-created-${item.id}`,
          date: createdDate,
          type: 'created',
          label: `${item.name} added`,
          sublabel: `${item.quantity} · ${item.storage_type}`,
          source: 'inventory',
        });
      }

      // Expiry event — show in whatever month the use_by falls in
      if (useby && inMonth(useby, y, m)) {
        const status = expiryStatus(useby);
        events.push({
          id: `inv-useby-${item.id}`,
          date: useby,
          type: status === 'ok' ? 'expiring' : status,
          label: `${item.name} use-by`,
          sublabel: `${item.quantity} · ${item.storage_type} · by ${item.added_by_name}`,
          source: 'inventory',
        });
      }
    }

    // ── Vacuum seal log ──────────────────────────────────────────────────────
    const vsItems = await db.all(
      'SELECT v.*, u.name AS added_by_name FROM vacuum_seal_log v JOIN users u ON u.id = v.added_by WHERE v.group_id = ?',
      [group_id]
    );

    for (const v of vsItems) {
      const sealDate = v.seal_date;
      const useby = v.use_by_date || v.expiry_date || calcUseBy(sealDate, 'vacuum-frozen');

      if (sealDate && inMonth(sealDate, y, m)) {
        events.push({
          id: `vs-created-${v.id}`,
          date: sealDate,
          type: 'created',
          label: `${v.item_name} sealed`,
          sublabel: v.quantity ? `${v.quantity} · vacuum sealed` : 'vacuum sealed',
          source: 'vacuum_log',
        });
      }

      if (useby && inMonth(useby, y, m)) {
        const status = expiryStatus(useby);
        events.push({
          id: `vs-useby-${v.id}`,
          date: useby,
          type: status === 'ok' ? 'expiring' : status,
          label: `${v.item_name} use-by`,
          sublabel: v.quantity ? `${v.quantity} · vacuum sealed` : 'vacuum sealed',
          source: 'vacuum_log',
        });
      }
    }

    // ── Bulk buy runs ────────────────────────────────────────────────────────
    const runs = await db.all(`
      SELECT r.*, u.name AS buyer_name
      FROM bulk_buy_runs r
      LEFT JOIN users u ON u.id = r.buyer_user_id
      WHERE r.group_id = ? AND r.run_date >= ? AND r.run_date < ?
    `, [group_id, monthStart, monthEnd]);

    for (const run of runs) {
      events.push({
        id: `bb-${run.id}`,
        date: run.run_date,
        type: 'bulk_buy',
        label: run.name,
        sublabel: run.buyer_name ? `Buyer: ${run.buyer_name}` : `Status: ${run.status}`,
        source: 'bulk_buy',
      });
    }

    // ── Harvest logs ─────────────────────────────────────────────────────────
    const harvests = await db.all(`
      SELECT h.*, u.name AS added_by_name
      FROM harvest_logs h JOIN users u ON u.id = h.added_by
      WHERE h.group_id = ? AND h.harvest_date >= ? AND h.harvest_date < ?
    `, [group_id, monthStart, monthEnd]);

    for (const h of harvests) {
      events.push({
        id: `harvest-${h.id}`,
        date: h.harvest_date,
        type: 'harvest',
        label: `${h.plant_name} harvested`,
        sublabel: h.yield_amount,
        source: 'harvest',
      });
    }

    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
