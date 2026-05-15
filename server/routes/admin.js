const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { superadminMiddleware, twoFaMiddleware } = require('../middleware/auth');

// All admin routes require superadmin role + valid 2FA session
router.use(superadminMiddleware);
router.use(twoFaMiddleware);

// GET /api/admin/stats — platform overview
router.get('/stats', async (req, res) => {
  try {
    const db = await getDb();
    const totalUsers   = await db.get("SELECT COUNT(*) as count FROM users WHERE role != 'superadmin'");
    const paidUsers    = await db.get("SELECT COUNT(*) as count FROM users WHERE plan = 'pro' AND role != 'superadmin'");
    const freeUsers    = await db.get("SELECT COUNT(*) as count FROM users WHERE plan = 'free' AND role != 'superadmin'");
    const totalGroups  = await db.get("SELECT COUNT(*) as count FROM groups");
    const totalMembers = await db.get("SELECT COUNT(*) as count FROM group_members");
    const newThisWeek  = await db.get("SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-7 days') AND role != 'superadmin'");

    res.json({
      totalUsers:   totalUsers.count,
      paidUsers:    paidUsers.count,
      freeUsers:    freeUsers.count,
      totalGroups:  totalGroups.count,
      totalMembers: totalMembers.count,
      newThisWeek:  newThisWeek.count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /api/admin/users — all users with group info
router.get('/users', async (req, res) => {
  try {
    const db = await getDb();
    const { search, plan, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE u.role != 'superadmin'";
    const params = [];

    if (search) {
      where += " AND (u.name LIKE ? OR u.email LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (plan && plan !== 'all') {
      where += " AND u.plan = ?";
      params.push(plan);
    }

    const users = await db.all(`
      SELECT
        u.id, u.name, u.email, u.plan, u.role, u.created_at,
        u.must_change_password,
        u.stripe_customer_id,
        COALESCE(
          (SELECT g.name FROM groups g WHERE g.owner_id = u.id LIMIT 1),
          (SELECT g.name FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = u.id AND g.owner_id != u.id LIMIT 1)
        ) AS group_name,
        CASE
          WHEN (SELECT 1 FROM groups WHERE owner_id = u.id LIMIT 1) IS NOT NULL THEN 'owner'
          WHEN (SELECT 1 FROM group_members WHERE user_id = u.id LIMIT 1) IS NOT NULL THEN 'member'
          ELSE NULL
        END AS group_role
      FROM users u
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const total = await db.get(`
      SELECT COUNT(*) as count FROM users u ${where}
    `, params);

    res.json({ users, total: total.count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// GET /api/admin/users/:id — single user detail with all group members
router.get('/users/:id', async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get(`
      SELECT u.id, u.name, u.email, u.plan, u.role, u.created_at,
             u.stripe_customer_id, u.stripe_subscription_id,
             g.id AS group_id, g.name AS group_name, g.invite_code
      FROM users u
      LEFT JOIN groups g ON g.owner_id = u.id
      WHERE u.id = ?
    `, [req.params.id]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get group members if user owns a group
    let members = [];
    if (user.group_id) {
      members = await db.all(`
        SELECT u.id, u.name, u.email, u.plan, gm.joined_at
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY gm.joined_at ASC
      `, [user.group_id]);
    }

    // Get groups user is a member of (not owner)
    const memberOf = await db.all(`
      SELECT g.id, g.name, gm.joined_at,
             u.name AS owner_name, u.email AS owner_email
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      JOIN users u ON u.id = g.owner_id
      WHERE gm.user_id = ? AND g.owner_id != ?
      ORDER BY gm.joined_at DESC
    `, [user.id, user.id]);

    res.json({ user, members, memberOf });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// PUT /api/admin/users/:id/plan — change user plan
router.put('/users/:id/plan', async (req, res) => {
  try {
    const db = await getDb();
    const { plan } = req.body;
    if (!['free', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    await db.run("UPDATE users SET plan = ? WHERE id = ?", [plan, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// PUT /api/admin/users/:id/role — change user role (legacy)
router.put('/users/:id/role', async (req, res) => {
  try {
    const db = await getDb();
    const { role } = req.body;
    if (!['member', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await db.run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const db = await getDb();
    const { role } = req.body;
    if (!['member', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await db.get("SELECT role FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/admin/users/:id — delete user account
router.delete('/users/:id', async (req, res) => {
  try {
    const db = await getDb();
    // Don't allow deleting superadmins
    const user = await db.get("SELECT role FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'superadmin') return res.status(403).json({ error: 'Cannot delete superadmin accounts' });

    await db.run("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/groups — all groups with owner and member info
router.get('/groups', async (req, res) => {
  try {
    const db = await getDb();
    const groups = await db.all(`
      SELECT g.id, g.name, g.invite_code, g.created_at,
             u.id AS owner_id, u.name AS owner_name, u.email AS owner_email, u.plan AS owner_plan,
             (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
      FROM groups g
      JOIN users u ON u.id = g.owner_id
      ORDER BY g.created_at DESC
    `);
    res.json({ groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load groups' });
  }
});

module.exports = router;
