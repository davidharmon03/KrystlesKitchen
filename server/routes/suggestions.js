const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const suggestionsRouter = express.Router();
const featureRouter     = express.Router();

// ── helpers ────────────────────────────────────────────────────────────────

async function isMember(db, groupId, userId) {
  const row = await db.get(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return !!row;
}

async function isGroupOwner(db, groupId, userId) {
  const row = await db.get(
    'SELECT id FROM groups WHERE id = ? AND owner_id = ?',
    [groupId, userId]
  );
  return !!row;
}

async function isAnyGroupOwner(db, userId) {
  const row = await db.get('SELECT id FROM groups WHERE owner_id = ?', [userId]);
  return !!row;
}

// ── meal suggestions ───────────────────────────────────────────────────────

// GET /api/suggestions?group_id=&status=
suggestionsRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const { group_id, status } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const db = await getDb();
    if (!(await isMember(db, group_id, req.user.id)))
      return res.status(403).json({ error: 'Not a member of this group' });

    let whereClause = 'WHERE ms.group_id = ?';
    const params = [req.user.id, group_id];

    if (status && status !== 'all') {
      if (status === 'past') {
        whereClause += " AND ms.status IN ('declined', 'used')";
      } else {
        whereClause += ' AND ms.status = ?';
        params.push(status);
      }
    }

    const suggestions = await db.all(`
      SELECT
        ms.id,
        ms.group_id,
        ms.meal_name,
        ms.description,
        ms.recipe_id,
        ms.status,
        ms.created_at,
        u.id   AS suggested_by_id,
        u.name AS suggested_by_name,
        COALESCE(SUM(CASE WHEN sv.vote = 'up'   THEN 1 ELSE 0 END), 0) AS upvotes,
        COALESCE(SUM(CASE WHEN sv.vote = 'down' THEN 1 ELSE 0 END), 0) AS downvotes,
        MAX(CASE WHEN sv.user_id = ? THEN sv.vote ELSE NULL END)        AS my_vote
      FROM meal_suggestions ms
      JOIN  users           u  ON u.id  = ms.suggested_by_user_id
      LEFT JOIN suggestion_votes sv ON sv.suggestion_id = ms.id
      ${whereClause}
      GROUP BY ms.id
      ORDER BY
        (COALESCE(SUM(CASE WHEN sv.vote = 'up'   THEN 1 ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN sv.vote = 'down' THEN 1 ELSE 0 END), 0)) DESC,
        ms.created_at DESC
    `, params);

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/suggestions
suggestionsRouter.post('/', authMiddleware, async (req, res) => {
  try {
    const { group_id, meal_name, description, recipe_id } = req.body;
    if (!group_id || !meal_name)
      return res.status(400).json({ error: 'group_id and meal_name are required' });

    const db = await getDb();
    if (!(await isMember(db, group_id, req.user.id)))
      return res.status(403).json({ error: 'Not a member of this group' });

    const id = uuidv4();
    await db.run(
      `INSERT INTO meal_suggestions
         (id, group_id, suggested_by_user_id, meal_name, description, recipe_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, group_id, req.user.id, meal_name.trim(), (description || '').trim(), recipe_id || null]
    );

    const row = await db.get(`
      SELECT ms.*, u.name AS suggested_by_name
      FROM   meal_suggestions ms
      JOIN   users u ON u.id = ms.suggested_by_user_id
      WHERE  ms.id = ?
    `, [id]);

    res.status(201).json({ ...row, upvotes: 0, downvotes: 0, my_vote: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/suggestions/:id/vote  — toggle up/down
suggestionsRouter.post('/:id/vote', authMiddleware, async (req, res) => {
  try {
    const { vote } = req.body;
    if (!vote || !['up', 'down'].includes(vote))
      return res.status(400).json({ error: 'vote must be "up" or "down"' });

    const db = await getDb();
    const suggestion = await db.get('SELECT * FROM meal_suggestions WHERE id = ?', [req.params.id]);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    if (!(await isMember(db, suggestion.group_id, req.user.id)))
      return res.status(403).json({ error: 'Not a member of this group' });

    const existing = await db.get(
      'SELECT * FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing) {
      if (existing.vote === vote) {
        // same vote — toggle off
        await db.run('DELETE FROM suggestion_votes WHERE id = ?', [existing.id]);
        return res.json({ my_vote: null });
      } else {
        // flip vote
        await db.run('UPDATE suggestion_votes SET vote = ? WHERE id = ?', [vote, existing.id]);
        return res.json({ my_vote: vote });
      }
    } else {
      await db.run(
        'INSERT INTO suggestion_votes (id, suggestion_id, user_id, vote) VALUES (?,?,?,?)',
        [uuidv4(), req.params.id, req.user.id, vote]
      );
      return res.json({ my_vote: vote });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/suggestions/:id/status — group owner only
suggestionsRouter.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['open', 'accepted', 'declined', 'used'];
    if (!status || !valid.includes(status))
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });

    const db = await getDb();
    const suggestion = await db.get('SELECT * FROM meal_suggestions WHERE id = ?', [req.params.id]);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    if (!(await isGroupOwner(db, suggestion.group_id, req.user.id)))
      return res.status(403).json({ error: 'Only the group owner can update suggestion status' });

    await db.run('UPDATE meal_suggestions SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ id: req.params.id, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── feature requests ───────────────────────────────────────────────────────

// GET /api/feature-requests
featureRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const requests = await db.all(`
      SELECT
        fr.id,
        fr.title,
        fr.description,
        fr.category,
        fr.status,
        fr.created_at,
        u.id   AS user_id,
        u.name AS submitted_by,
        COUNT(frv.id) AS votes,
        MAX(CASE WHEN frv.user_id = ? THEN 1 ELSE 0 END) AS my_vote
      FROM feature_requests fr
      JOIN  users u ON u.id = fr.user_id
      LEFT JOIN feature_request_votes frv ON frv.request_id = fr.id
      GROUP BY fr.id
      ORDER BY COUNT(frv.id) DESC, fr.created_at DESC
    `, [req.user.id]);

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/feature-requests
featureRouter.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const validCats = ['bug', 'feature', 'improvement', 'other'];
    const cat = validCats.includes(category) ? category : 'other';

    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO feature_requests (id, user_id, title, description, category) VALUES (?,?,?,?,?)',
      [id, req.user.id, title.trim(), (description || '').trim(), cat]
    );

    const row = await db.get(`
      SELECT fr.*, u.name AS submitted_by
      FROM   feature_requests fr
      JOIN   users u ON u.id = fr.user_id
      WHERE  fr.id = ?
    `, [id]);

    res.status(201).json({ ...row, votes: 0, my_vote: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/feature-requests/:id/vote — toggle upvote
featureRouter.post('/:id/vote', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const request = await db.get('SELECT id FROM feature_requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Feature request not found' });

    const existing = await db.get(
      'SELECT id FROM feature_request_votes WHERE request_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing) {
      await db.run('DELETE FROM feature_request_votes WHERE id = ?', [existing.id]);
      return res.json({ my_vote: 0 });
    } else {
      await db.run(
        'INSERT INTO feature_request_votes (id, request_id, user_id) VALUES (?,?,?)',
        [uuidv4(), req.params.id, req.user.id]
      );
      return res.json({ my_vote: 1 });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/feature-requests/:id — admin (any group owner) only
featureRouter.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    if (!(await isAnyGroupOwner(db, req.user.id)))
      return res.status(403).json({ error: 'Admin only' });

    const { status } = req.body;
    const valid = ['submitted', 'reviewing', 'planned', 'shipped', 'declined'];
    if (!status || !valid.includes(status))
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });

    const request = await db.get('SELECT id FROM feature_requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Feature request not found' });

    await db.run('UPDATE feature_requests SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ id: req.params.id, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { suggestionsRouter, featureRouter };
