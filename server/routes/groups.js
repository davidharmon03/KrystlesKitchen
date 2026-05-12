require('dotenv').config();
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification, notifyGroupMembers } = require('./notifications');

const MAX_MEMBERS = 5;

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function makeTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function inviteEmailHtml({ groupName, inviterName, acceptUrl, isNew }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Georgia, serif; background: #faf9f6; color: #1a1a18; margin: 0; padding: 40px 20px; }
  .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  h1 { font-size: 22px; margin-bottom: 8px; color: #1a1a18; }
  p { font-size: 15px; line-height: 1.6; color: #4a4a46; margin: 12px 0; }
  .btn { display: inline-block; margin-top: 24px; padding: 14px 28px; background: #4a7c59; color: #fff !important;
    text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
  .footer { margin-top: 32px; font-size: 12px; color: #9a9a96; }
  .url { word-break: break-all; color: #9a9a96; font-size: 12px; margin-top: 8px; }
</style></head>
<body>
  <div class="card">
    <h1>You're invited to join ${groupName}</h1>
    <p><strong>${inviterName}</strong> has invited you to join their group on <strong>Krystle's Brand Hub</strong> — a shared space for recipes, group finances, inventory, and garden tracking.</p>
    ${isNew
      ? '<p>You\'ll need to create a free account to accept. It only takes a minute.</p>'
      : '<p>Since you already have an account, just click below and you\'ll be added instantly.</p>'
    }
    <a class="btn" href="${acceptUrl}">Accept Invitation</a>
    <p class="url">${acceptUrl}</p>
    <div class="footer">If you didn't expect this invite, you can safely ignore this email.</div>
  </div>
</body>
</html>`;
}

// POST /api/groups
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const db = await getDb();
    let invite_code, attempts = 0;
    do {
      invite_code = generateCode();
      if (++attempts > 20) return res.status(500).json({ error: 'Could not generate unique invite code' });
    } while (await db.get('SELECT id FROM groups WHERE invite_code = ?', [invite_code]));

    const id = uuidv4();
    await db.run('INSERT INTO groups (id, name, invite_code, owner_id) VALUES (?,?,?,?)',
      [id, name, invite_code, req.user.id]);
    await db.run('INSERT INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
      [uuidv4(), id, req.user.id]);

    res.status(201).json({ id, name, invite_code, owner_id: req.user.id, member_count: 1 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const groups = await db.all(`
      SELECT g.id, g.name, g.invite_code, g.owner_id, g.created_at,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
      FROM groups g JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ? ORDER BY g.created_at DESC
    `, [req.user.id]);
    res.json(groups);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/groups/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const member = await db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    if (!member) return res.status(403).json({ error: 'Not a member of this group' });

    const membersRaw = await db.all(`
      SELECT u.id, u.name, u.email, u.social_links, gm.joined_at, gm.last_synced_at
      FROM users u JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = ? ORDER BY gm.joined_at
    `, [req.params.id]);
    const members = membersRaw.map(m => {
      let social_links = {};
      try { social_links = JSON.parse(m.social_links || '{}') } catch {}
      return { ...m, social_links };
    });

    const invitations = await db.all(`
      SELECT id, email, status, created_at FROM group_invitations
      WHERE group_id = ? ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({ ...group, members, invitations });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/groups/join  (by invite code)
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { invite_code } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'invite_code is required' });

    const db = await getDb();
    const group = await db.get('SELECT * FROM groups WHERE invite_code = ?', [invite_code.toUpperCase()]);
    if (!group) return res.status(404).json({ error: 'Invalid invite code' });

    const already = await db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group.id, req.user.id]);
    if (already) return res.status(409).json({ error: 'Already a member' });

    const count = await db.get('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [group.id]);
    if (count.c >= MAX_MEMBERS) return res.status(403).json({ error: 'Group is full (max 5 members)' });

    await db.run('INSERT INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
      [uuidv4(), group.id, req.user.id]);
    res.json({ message: 'Joined group', group_id: group.id, group_name: group.name });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/groups/:id/invite
router.post('/:id/invite', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = await db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    if (!isMember) return res.status(403).json({ error: 'Not a group member' });

    const { invites } = req.body;
    if (!Array.isArray(invites) || invites.length === 0)
      return res.status(400).json({ error: 'invites array is required' });

    const results = [];
    const inviterName = req.user.name;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    for (const invite of invites) {
      const email = invite.email?.toLowerCase().trim();
      if (!email) { results.push({ email, status: 'skipped', reason: 'no email' }); continue; }

      const count = await db.get('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [req.params.id]);
      if (count.c >= MAX_MEMBERS) {
        results.push({ email, status: 'skipped', reason: 'group full' }); continue;
      }

      const existingUser = await db.get('SELECT id, name FROM users WHERE email = ?', [email]);
      if (existingUser) {
        const alreadyMember = await db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
          [req.params.id, existingUser.id]);
        if (alreadyMember) {
          results.push({ email, status: 'already_member' }); continue;
        }
        await db.run('INSERT OR IGNORE INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
          [uuidv4(), req.params.id, existingUser.id]);
        results.push({ email, name: existingUser.name, status: 'added' });
        continue;
      }

      const existing_invite = await db.get(
        "SELECT id FROM group_invitations WHERE group_id = ? AND email = ? AND status = 'pending'",
        [req.params.id, email]
      );
      if (existing_invite) {
        results.push({ email, status: 'already_invited' }); continue;
      }

      const token = crypto.randomBytes(32).toString('hex');
      await db.run(
        'INSERT INTO group_invitations (id, group_id, email, token, invited_by) VALUES (?,?,?,?,?)',
        [uuidv4(), req.params.id, email, token, req.user.id]
      );

      const acceptUrl = `${frontendUrl}/accept-invite?token=${token}`;

      try {
        const transport = makeTransport();
        await transport.sendMail({
          from: `"Krystle's Brand Hub" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `You're invited to join ${group.name}`,
          html: inviteEmailHtml({ groupName: group.name, inviterName, acceptUrl, isNew: true }),
        });
        results.push({ email, status: 'invited' });
      } catch (mailErr) {
        console.error('Email send failed:', mailErr.message);
        results.push({ email, status: 'invited_no_email', accept_url: acceptUrl });
      }
      // Notify the invited user if they already have an account
      const invitedUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (invitedUser) {
        createNotification({
          user_id: invitedUser.id,
          group_id: req.params.id,
          type: 'invite_received',
          title: 'Group invitation',
          message: `${inviterName} invited you to join "${group.name}".`,
          link: `/accept-invite?token=${token}`
        });
      }
    }

    res.json({ results });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/groups/accept-invite/:token
router.get('/accept-invite/:token', async (req, res) => {
  try {
    const db = await getDb();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inv = await db.get(
      "SELECT * FROM group_invitations WHERE token = ? AND status = 'pending'",
      [req.params.token]
    );
    if (!inv) return res.redirect(`${frontendUrl}/login?invite_error=invalid`);

    const user = await db.get('SELECT id FROM users WHERE email = ?', [inv.email]);
    if (user) {
      const count = await db.get('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [inv.group_id]);
      if (count.c < 5) {
        await db.run('INSERT OR IGNORE INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
          [uuidv4(), inv.group_id, user.id]);
      }
      await db.run("UPDATE group_invitations SET status = 'accepted' WHERE token = ?", [req.params.token]);
      return res.redirect(`${frontendUrl}/login?invited=1`);
    }

    res.redirect(`${frontendUrl}/register?invite=${req.params.token}&email=${encodeURIComponent(inv.email)}`);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/groups/:id/members/:userId
// PUT /api/groups/:id/sync-ping — mark this user as synced right now
router.put('/:id/sync-ping', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const member = await db.get(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Not a group member' });
    const now = new Date().toISOString();
    await db.run(
      'UPDATE group_members SET last_synced_at = ? WHERE group_id = ? AND user_id = ?',
      [now, req.params.id, req.user.id]
    );
    res.json({ ok: true, last_synced_at: now });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner_id !== req.user.id && req.params.userId !== req.user.id)
      return res.status(403).json({ error: 'Not authorized' });

    await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]);
    res.json({ message: 'Member removed' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
