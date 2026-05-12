require('dotenv').config();
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_NOTIFICATION_PREFS } = require('./auth');

function makeTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function dateRange(daysBack = 7) {
  const end   = new Date();
  const start = new Date(Date.now() - daysBack * 86400000);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

function weekLabel() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function nextWeekMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

async function buildDigestData(groupId) {
  const db = await getDb();
  const { start, end } = dateRange(7);
  const nextMon = nextWeekMonday();

  const group = await db.get('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) throw new Error('Group not found');

  const allMembers = await db.all(`
    SELECT u.id, u.name, u.email, u.notification_prefs FROM users u
    JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `, [groupId]);

  // Filter out members who have opted out of the weekly email digest
  const members = allMembers.filter(m => {
    let prefs = {};
    try { prefs = JSON.parse(m.notification_prefs || '{}'); } catch {}
    const effective = { ...DEFAULT_NOTIFICATION_PREFS, ...prefs };
    return effective.email_digest !== false;
  });

  const meals = await db.all(`
    SELECT i.name, i.quantity, i.storage_type, u.name AS added_by_name, i.created_at
    FROM inventory_items i JOIN users u ON u.id = i.added_by
    WHERE i.group_id = ? AND DATE(i.created_at) BETWEEN ? AND ?
    ORDER BY i.created_at DESC LIMIT 15
  `, [groupId, start, end]);

  const expiring = await db.all(`
    SELECT name, quantity, use_by_date FROM inventory_items
    WHERE group_id = ? AND use_by_date IS NOT NULL AND use_by_date BETWEEN ? AND ?
    ORDER BY use_by_date ASC
  `, [groupId, end, dateRange(0).end]);

  // Items expiring in next 7 days
  const expiringNext7 = await db.all(`
    SELECT name, quantity, use_by_date FROM inventory_items
    WHERE group_id = ? AND use_by_date IS NOT NULL
      AND use_by_date BETWEEN DATE('now') AND DATE('now','+7 days')
    ORDER BY use_by_date ASC
  `, [groupId]);

  const bulkRuns = await db.all(`
    SELECT r.name, r.run_date, r.status, u.name AS buyer_name
    FROM bulk_buy_runs r LEFT JOIN users u ON u.id = r.buyer_user_id
    WHERE r.group_id = ? AND r.run_date >= DATE('now')
    ORDER BY r.run_date ASC LIMIT 5
  `, [groupId]);

  const harvests = await db.all(`
    SELECT h.plant_name, h.yield_amount, h.harvest_date, u.name AS added_by_name
    FROM harvest_logs h JOIN users u ON u.id = h.added_by
    WHERE h.group_id = ? AND DATE(h.harvest_date) BETWEEN ? AND ?
    ORDER BY h.harvest_date DESC LIMIT 10
  `, [groupId, start, end]);

  // Recent recipes with sides recommendations
  const recipesWithSides = await db.all(`
    SELECT r.title, r.sides, u.name AS author_name
    FROM recipes r JOIN users u ON u.id = r.author_id
    WHERE (r.group_id = ? OR r.is_public = 1)
      AND r.sides IS NOT NULL AND r.sides != ''
    ORDER BY r.created_at DESC LIMIT 8
  `, [groupId]);

  // Swap schedule for next week
  const swapSchedule = await db.get(
    'SELECT * FROM swap_schedule WHERE group_id = ? AND week_start = ?',
    [groupId, nextMon]
  );
  const swapAssignments = swapSchedule ? await db.all(`
    SELECT sa.day_of_week, u.name AS user_name, sa.meal_name, r.title AS recipe_title
    FROM swap_assignments sa
    JOIN users u ON u.id = sa.user_id
    LEFT JOIN recipes r ON r.id = sa.recipe_id
    WHERE sa.schedule_id = ?
    ORDER BY sa.day_of_week ASC
  `, [swapSchedule.id]) : [];

  return { group, members, meals, expiringNext7, bulkRuns, harvests, swapAssignments, recipesWithSides };
}

function buildDigestHtml({ group, meals, expiringNext7, bulkRuns, harvests, swapAssignments, recipesWithSides }) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const section = (title, emoji, content) => `
    <div style="margin: 28px 0 0;">
      <h2 style="font-size:16px;font-weight:700;color:#1a1a18;margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid #e8e4dc;">
        ${emoji} ${title}
      </h2>
      ${content}
    </div>
  `;

  const row = (left, right) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#2d2d2a;">${left}</td>
      <td style="padding:6px 0;font-size:13px;color:#7a7a76;text-align:right;">${right}</td>
    </tr>
  `;

  const emptyMsg = msg => `<p style="color:#9a9a96;font-size:13px;font-style:italic;margin:4px 0;">${msg}</p>`;

  const mealsHtml = meals.length ? `
    <table style="width:100%;border-collapse:collapse;">
      ${meals.map(m => row(
        `<strong>${m.name}</strong> <span style="color:#9a9a96;font-size:12px;">(${m.quantity})</span>`,
        `${m.added_by_name} · ${m.storage_type}`
      )).join('')}
    </table>
  ` : emptyMsg('Nothing added this week.');

  const expiringHtml = expiringNext7.length ? `
    <table style="width:100%;border-collapse:collapse;">
      ${expiringNext7.map(e => row(
        `⚠️ <strong>${e.name}</strong> <span style="color:#9a9a96;font-size:12px;">(${e.quantity})</span>`,
        `Use by ${e.use_by_date}`
      )).join('')}
    </table>
  ` : emptyMsg('Nothing expiring soon — great job!');

  const bulkHtml = bulkRuns.length ? `
    <table style="width:100%;border-collapse:collapse;">
      ${bulkRuns.map(b => row(
        `<strong>${b.name}</strong>`,
        `${b.run_date}${b.buyer_name ? ` · ${b.buyer_name}` : ''}`
      )).join('')}
    </table>
  ` : emptyMsg('No upcoming bulk buy runs.');

  const harvestHtml = harvests.length ? `
    <table style="width:100%;border-collapse:collapse;">
      ${harvests.map(h => row(
        `<strong>${h.plant_name}</strong>`,
        `${h.yield_amount} · ${h.added_by_name}`
      )).join('')}
    </table>
  ` : emptyMsg('No harvests logged this week.');

  const sidesHtml = (recipesWithSides || []).length ? `
    <table style="width:100%;border-collapse:collapse;">
      ${(recipesWithSides || []).map(r => row(
        `<strong>${r.title}</strong> <span style="color:#9a9a96;font-size:12px;">by ${r.author_name}</span>`,
        r.sides
      )).join('')}
    </table>
  ` : emptyMsg('No side dish recommendations yet — add sides to your recipes in the Kitchen.');

  const swapRows = swapAssignments.map(a => row(
    `<strong>${DAYS[a.day_of_week]}</strong>`,
    `${a.user_name} — ${a.recipe_title || a.meal_name || '(TBD)'}`
  )).join('');
  const swapHtml = swapAssignments.length
    ? `<table style="width:100%;border-collapse:collapse;">${swapRows}</table>`
    : emptyMsg('No swap schedule yet for next week.');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;background:#faf9f6;color:#1a1a18;margin:0;padding:40px 20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#4a7c59;color:#fff;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;font-weight:700;text-align:center;">K</div>
    </div>
    <h1 style="font-size:22px;font-weight:700;color:#1a1a18;margin:0 0 4px;text-align:center;">${group.name}</h1>
    <p style="text-align:center;color:#7a7a76;font-size:14px;margin:0 0 8px;">Weekly Digest — Week of ${weekLabel()}</p>
    <hr style="border:none;border-top:1px solid #e8e4dc;margin:20px 0;" />

    ${section('Entrées & Inventory Added This Week', '🥗', mealsHtml)}
    ${section('Items Expiring in the Next 7 Days', '⏰', expiringHtml)}
    ${section('Upcoming Bulk Buy Runs', '🛒', bulkHtml)}
    ${section('Swap Schedule — Next Week', '🔄', swapHtml)}
    ${section('Harvests Logged This Week', '🌿', harvestHtml)}
    ${section('Suggested Sides — From the Kitchen', '🥦', sidesHtml)}

    <div style="margin-top:36px;padding-top:20px;border-top:1px solid #e8e4dc;text-align:center;font-size:12px;color:#9a9a96;">
      Sent by Krystle's Brand Hub · Your group cooking companion
    </div>
  </div>
</body>
</html>`;
}

// GET /api/digest/preview?group_id=
router.get('/preview', authMiddleware, async (req, res) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const db = await getDb();
    const member = await db.get(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Not a group member' });

    const data = await buildDigestData(group_id);
    const html = buildDigestHtml(data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/digest/send?group_id=
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const group_id = req.query.group_id || req.body.group_id;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const db = await getDb();
    // Only group owner/members can send
    const member = await db.get(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Not a group member' });

    const data = await buildDigestData(group_id);
    const html = buildDigestHtml(data);
    const subject = `${data.group.name} Weekly Digest — Week of ${weekLabel()}`;

    if (!process.env.EMAIL_USER) {
      return res.status(500).json({ error: 'Email not configured. Set EMAIL_USER and EMAIL_PASS in .env' });
    }

    const transport = makeTransport();
    const results = [];

    for (const m of data.members) {
      try {
        await transport.sendMail({
          from:    `"${data.group.name}" <${process.env.EMAIL_USER}>`,
          to:      m.email,
          subject,
          html,
        });
        results.push({ email: m.email, status: 'sent' });
      } catch (e) {
        results.push({ email: m.email, status: 'failed', error: e.message });
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Export buildDigestData + buildDigestHtml for cron use
module.exports = router;
module.exports.buildDigestData = buildDigestData;
module.exports.buildDigestHtml = buildDigestHtml;
module.exports.weekLabel = weekLabel;
module.exports.makeTransport = makeTransport;
