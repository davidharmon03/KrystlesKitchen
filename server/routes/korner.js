const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const multer = require('multer');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { compressImage } = require('../utils/compressImage');

const receiptDir = path.join(__dirname, '../uploads/receipts');

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

async function requireMember(groupId, userId) {
  const db = await getDb();
  return db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
}

// GET /:groupId/receipts
router.get('/:groupId/receipts', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const rows = await db.all(`
      SELECT r.*, u.name AS user_name
      FROM receipts r JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.groupId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/receipts
router.post('/:groupId/receipts', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { amount, description } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required' });
    const db = await getDb();
    const id = uuidv4();
    let image_path = null;
    if (req.file) {
      const filename = await compressImage(req.file.buffer, receiptDir, uuidv4(), { maxWidth: 1600 });
      image_path = `/uploads/receipts/${filename}`;
    }
    await db.run(
      'INSERT INTO receipts (id, group_id, user_id, amount, description, image_path) VALUES (?,?,?,?,?,?)',
      [id, req.params.groupId, req.user.id, parseFloat(amount), description || '', image_path]
    );
    const created = await db.get(
      'SELECT r.*, u.name AS user_name FROM receipts r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
      [id]
    );
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /:groupId/receipts/:id
router.delete('/:groupId/receipts/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.user_id !== req.user.id) return res.status(403).json({ error: 'Not your receipt' });
    await db.run('DELETE FROM receipts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/equalizer
router.get('/:groupId/equalizer', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const members = await db.all(`
      SELECT u.id, u.name FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `, [req.params.groupId]);

    const memberCount = members.length || 1;
    const totalRow = await db.get('SELECT SUM(amount) AS total FROM receipts WHERE group_id = ?', [req.params.groupId]);
    const total = totalRow.total || 0;
    const fairShare = total / memberCount;

    const memberTotals = await db.all(`
      SELECT user_id, SUM(amount) AS paid FROM receipts WHERE group_id = ? GROUP BY user_id
    `, [req.params.groupId]);

    const paidMap = {};
    for (const m of memberTotals) paidMap[m.user_id] = m.paid;

    const breakdown = members.map(m => ({
      user_id: m.id,
      name: m.name,
      paid: paidMap[m.id] || 0,
      fair_share: fairShare,
      balance: (paidMap[m.id] || 0) - fairShare,
    }));

    const settlements = [];
    const debtors   = breakdown.filter(b => b.balance < -0.01).map(b => ({ ...b }));
    const creditors = breakdown.filter(b => b.balance >  0.01).map(b => ({ ...b }));

    for (const debtor of debtors) {
      let remaining = Math.abs(debtor.balance);
      for (const creditor of creditors) {
        if (remaining <= 0.01) break;
        if (creditor.balance <= 0.01) continue;
        const amount = Math.min(remaining, creditor.balance);
        settlements.push({ from: debtor.name, to: creditor.name, amount: Math.round(amount * 100) / 100 });
        creditor.balance -= amount;
        remaining -= amount;
      }
    }

    res.json({ total, fair_share: fairShare, member_count: memberCount, breakdown, settlements });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/meal-credits
router.get('/:groupId/meal-credits', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();
    const transactions = await db.all(`
      SELECT mc.*, u.name AS user_name
      FROM meal_credits mc JOIN users u ON u.id = mc.user_id
      WHERE mc.group_id = ?
      ORDER BY mc.created_at DESC
    `, [req.params.groupId]);
    const balances = await db.all(`
      SELECT mc.user_id, u.name, SUM(mc.credits) AS total_credits
      FROM meal_credits mc JOIN users u ON u.id = mc.user_id
      WHERE mc.group_id = ?
      GROUP BY mc.user_id
    `, [req.params.groupId]);
    res.json({ transactions, balances });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /:groupId/meal-credits
router.post('/:groupId/meal-credits', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const { user_id, credits, description } = req.body;
    if (!user_id || credits === undefined)
      return res.status(400).json({ error: 'user_id and credits are required' });
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO meal_credits (id, group_id, user_id, credits, description, added_by) VALUES (?,?,?,?,?,?)',
      [id, req.params.groupId, user_id, credits, description || '', req.user.id]
    );
    const created = await db.get(
      'SELECT mc.*, u.name AS user_name FROM meal_credits mc JOIN users u ON u.id = mc.user_id WHERE mc.id = ?',
      [id]
    );
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /:groupId/stats — spending charts data
router.get('/:groupId/stats', authMiddleware, async (req, res) => {
  try {
    if (!await requireMember(req.params.groupId, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    const db = await getDb();

    // Monthly spend — build last 6 months in JS, fill gaps with 0
    const rawMonthly = await db.all(`
      SELECT strftime('%Y-%m', created_at) AS month_key, SUM(amount) AS total
      FROM receipts
      WHERE group_id = ?
        AND created_at >= date('now', '-5 months', 'start of month')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month_key
    `, [req.params.groupId]);

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.push({ key, label, total: 0 });
    }
    for (const row of rawMonthly) {
      const m = months.find(x => x.key === row.month_key);
      if (m) m.total = Math.round((row.total || 0) * 100) / 100;
    }
    const monthlySpend = months.map(({ label, total }) => ({ month: label, total }));

    // Spend by member
    const spendByMember = await db.all(`
      SELECT u.name, ROUND(SUM(r.amount), 2) AS total
      FROM receipts r JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ?
      GROUP BY r.user_id, u.name
      ORDER BY total DESC
    `, [req.params.groupId]);

    res.json({ monthlySpend, spendByMember });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
