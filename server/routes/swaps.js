const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { notifyGroupMembers, createNotification } = require('./notifications');

async function requireMember(groupId, userId) {
  const db = await getDb();
  return db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
}

async function requireAdmin(groupId, userId) {
  const db = await getDb();
  return db.get('SELECT id FROM groups WHERE id = ? AND owner_id = ?', [groupId, userId]);
}

const ENTREE_SELECT = `
  SELECT se.*, u.name AS user_name, u.avatar_path, r.title AS recipe_title
  FROM swap_entrees se
  JOIN users u ON u.id = se.user_id
  LEFT JOIN recipes r ON r.id = se.recipe_id
  WHERE se.week_id = ?
  ORDER BY u.name ASC
`;

// GET /api/swaps?group_id= — active swap week with entrees + member info
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });
    if (!await requireMember(group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const db = await getDb();
    const week = await db.get(
      "SELECT * FROM swap_weeks WHERE group_id = ? AND status = 'active' ORDER BY swap_day DESC LIMIT 1",
      [group_id]
    );

    if (!week) return res.json({ week: null, entrees: [] });

    const entrees = await db.all(ENTREE_SELECT, [week.id]);

    // Add sides to each entree
    for (const entree of entrees) {
      const sides = await db.all(
        'SELECT side_name FROM entree_sides WHERE entree_id = ? ORDER BY sort_order ASC',
        [entree.id]
      );
      entree.sides = sides.map(s => s.side_name);
    }

    res.json({ week, entrees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/swaps/history?group_id= — past completed weeks
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });
    if (!await requireMember(group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const db = await getDb();
    const weeks = await db.all(
      "SELECT * FROM swap_weeks WHERE group_id = ? AND status = 'completed' ORDER BY swap_day DESC LIMIT 10",
      [group_id]
    );

    const result = [];
    for (const week of weeks) {
      const entrees = await db.all(ENTREE_SELECT, [week.id]);

      // Add sides to each entree
      for (const entree of entrees) {
        const sides = await db.all(
          'SELECT side_name FROM entree_sides WHERE entree_id = ? ORDER BY sort_order ASC',
          [entree.id]
        );
        entree.sides = sides.map(s => s.side_name);
      }

      result.push({ week, entrees });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/swaps — create new swap week with assignments (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { group_id, swap_day, week_label, entrees } = req.body;
    if (!group_id || !swap_day) return res.status(400).json({ error: 'group_id and swap_day required' });
    if (!await requireMember(group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });
    if (!await requireAdmin(group_id, req.user.id))
      return res.status(403).json({ error: 'Admin only' });

    const db = await getDb();
    const weekId = uuidv4();
    await db.run(
      'INSERT INTO swap_weeks (id, group_id, swap_day, week_label, status, created_by) VALUES (?,?,?,?,?,?)',
      [weekId, group_id, swap_day, week_label || '', 'active', req.user.id]
    );

    if (Array.isArray(entrees)) {
      for (const e of entrees) {
        if (!e.user_id || !e.entree_name) continue;
        const entreeId = uuidv4();
        await db.run(
          'INSERT INTO swap_entrees (id, week_id, user_id, entree_name, recipe_id, notes, status) VALUES (?,?,?,?,?,?,?)',
          [entreeId, weekId, e.user_id, e.entree_name, e.recipe_id || null, e.notes || '', 'assigned']
        );
        // Add sides if provided
        if (Array.isArray(e.sides) && e.sides.length > 0) {
          for (let i = 0; i < e.sides.length; i++) {
            const sideName = e.sides[i].trim();
            if (sideName) {
              await db.run(
                'INSERT INTO entree_sides (id, entree_id, side_name, sort_order) VALUES (?,?,?,?)',
                [uuidv4(), entreeId, sideName, i]
              );
            }
          }
        }
      }
    }

    // Notify all group members
    const creator = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const swapDate = new Date(swap_day + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    notifyGroupMembers({
      group_id,
      exclude_user_id: req.user.id,
      type: 'swap_week_created',
      title: 'New Entree Swap Week',
      message: `${creator?.name} set up a new entree swap. Swap Day is ${swapDate}.`,
      link: '/swap'
    });

    const week = await db.get('SELECT * FROM swap_weeks WHERE id = ?', [weekId]);
    const entreeRows = await db.all(ENTREE_SELECT, [weekId]);
    res.status(201).json({ week, entrees: entreeRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/swaps/:weekId/entrees/:entreeId — update entree status/notes (own entree only)
router.put('/:weekId/entrees/:entreeId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const week = await db.get('SELECT * FROM swap_weeks WHERE id = ?', [req.params.weekId]);
    if (!week) return res.status(404).json({ error: 'Swap week not found' });
    if (!await requireMember(week.group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const entree = await db.get(
      'SELECT * FROM swap_entrees WHERE id = ? AND week_id = ?',
      [req.params.entreeId, req.params.weekId]
    );
    if (!entree) return res.status(404).json({ error: 'Entree not found' });

    // Only the assigned member (or group admin) can update
    const isAdmin = await requireAdmin(week.group_id, req.user.id);
    if (entree.user_id !== req.user.id && !isAdmin)
      return res.status(403).json({ error: 'You can only update your own entree' });

    const { status, notes, entree_name, recipe_id } = req.body;
    const validStatuses = ['assigned', 'in_progress', 'ready', 'swapped'];
    if (status && !validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const newStatus      = status      !== undefined ? status      : entree.status;
    const newNotes       = notes       !== undefined ? notes       : entree.notes;
    const newEntreeName  = entree_name !== undefined ? entree_name : entree.entree_name;
    const newRecipeId    = recipe_id   !== undefined ? (recipe_id || null) : entree.recipe_id;

    await db.run(
      "UPDATE swap_entrees SET status=?, notes=?, entree_name=?, recipe_id=?, updated_at=datetime('now') WHERE id=?",
      [newStatus, newNotes, newEntreeName, newRecipeId, entree.id]
    );

    // Notify group when entree flips to ready
    if (status === 'ready' && entree.status !== 'ready') {
      const member = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
      notifyGroupMembers({
        group_id: week.group_id,
        exclude_user_id: req.user.id,
        type: 'entree_ready',
        title: 'Entree is Ready! 🟢',
        message: `${member?.name}'s ${newEntreeName} is ready for swap day!`,
        link: '/swap'
      });
    }

    const updated = await db.get(
      `SELECT se.*, u.name AS user_name, u.avatar_path, r.title AS recipe_title
       FROM swap_entrees se
       JOIN users u ON u.id = se.user_id
       LEFT JOIN recipes r ON r.id = se.recipe_id
       WHERE se.id = ?`,
      [entree.id]
    );

    // Add sides
    const sides = await db.all(
      'SELECT side_name FROM entree_sides WHERE entree_id = ? ORDER BY sort_order ASC',
      [entree.id]
    );
    updated.sides = sides.map(s => s.side_name);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/swaps/:weekId/complete — mark week as complete (admin only)
router.put('/:weekId/complete', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const week = await db.get('SELECT * FROM swap_weeks WHERE id = ?', [req.params.weekId]);
    if (!week) return res.status(404).json({ error: 'Swap week not found' });
    if (!await requireAdmin(week.group_id, req.user.id))
      return res.status(403).json({ error: 'Admin only' });

    await db.run("UPDATE swap_weeks SET status = 'completed' WHERE id = ?", [req.params.weekId]);
    // Advance any entrees that aren't already swapped
    await db.run(
      "UPDATE swap_entrees SET status = 'swapped', updated_at = datetime('now') WHERE week_id = ? AND status != 'swapped'",
      [req.params.weekId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/swaps/:weekId/entrees/:entreeId/rate — submit an entree rating (1-5 stars)
router.post('/:weekId/entrees/:entreeId/rate', authMiddleware, async (req, res) => {
  try {
    const { stars, comment } = req.body;
    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ error: 'stars must be 1-5' });

    const db = await getDb();
    const entree = await db.get(
      'SELECT se.*, sw.group_id FROM swap_entrees se JOIN swap_weeks sw ON sw.id = se.week_id WHERE se.id = ?',
      [req.params.entreeId]
    );
    if (!entree) return res.status(404).json({ error: 'Entree not found' });
    if (!await requireMember(entree.group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    // Check if week is completed (can only rate completed entrees)
    const week = await db.get('SELECT status FROM swap_weeks WHERE id = ?', [req.params.weekId]);
    if (!week || week.status !== 'completed')
      return res.status(403).json({ error: 'Can only rate entrees from completed swap weeks' });

    // Check if user is rating someone else's entree (not their own)
    if (entree.user_id === req.user.id)
      return res.status(403).json({ error: 'You cannot rate your own entree' });

    const id = uuidv4();
    await db.run(
      'INSERT OR REPLACE INTO meal_ratings (id, entree_id, rated_by, stars, comment, created_at) VALUES (?,?,?,?,?,datetime("now"))',
      [id, req.params.entreeId, req.user.id, stars, comment || '']
    );

    const rating = await db.get(
      'SELECT * FROM meal_ratings WHERE entree_id = ? AND rated_by = ?',
      [req.params.entreeId, req.user.id]
    );

    res.status(201).json(rating);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/recipes/:recipeId/ratings — get average rating and history for a recipe
router.get('/ratings/:recipeId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    // Get all ratings for entrees with this recipe
    const ratings = await db.all(`
      SELECT mr.*, se.entree_name, u.name AS rater_name
      FROM meal_ratings mr
      JOIN swap_entrees se ON se.id = mr.entree_id
      JOIN users u ON u.id = mr.rated_by
      WHERE se.recipe_id = ?
      ORDER BY mr.created_at DESC
    `, [req.params.recipeId]);

    // Calculate average
    const avgRating = ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : null;

    res.json({
      recipe_id: req.params.recipeId,
      average_rating: parseFloat(avgRating) || null,
      rating_count: ratings.length,
      ratings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/swaps/:weekId/entrees/:entreeId/sides — get all sides for an entree
router.get('/:weekId/entrees/:entreeId/sides', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const week = await db.get('SELECT * FROM swap_weeks WHERE id = ?', [req.params.weekId]);
    if (!week) return res.status(404).json({ error: 'Swap week not found' });
    if (!await requireMember(week.group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const sides = await db.all(
      'SELECT id, side_name, sort_order FROM entree_sides WHERE entree_id = ? ORDER BY sort_order ASC',
      [req.params.entreeId]
    );

    res.json(sides);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/swaps/:weekId/entrees/:entreeId/sides — replace all sides for an entree
router.post('/:weekId/entrees/:entreeId/sides', authMiddleware, async (req, res) => {
  try {
    const { sides } = req.body;
    if (!Array.isArray(sides)) {
      return res.status(400).json({ error: 'sides must be an array' });
    }

    const db = await getDb();
    const week = await db.get('SELECT * FROM swap_weeks WHERE id = ?', [req.params.weekId]);
    if (!week) return res.status(404).json({ error: 'Swap week not found' });
    if (!await requireMember(week.group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const entree = await db.get(
      'SELECT * FROM swap_entrees WHERE id = ? AND week_id = ?',
      [req.params.entreeId, req.params.weekId]
    );
    if (!entree) return res.status(404).json({ error: 'Entree not found' });

    // Only the assigned member (or group admin) can update
    const isAdmin = await requireAdmin(week.group_id, req.user.id);
    if (entree.user_id !== req.user.id && !isAdmin)
      return res.status(403).json({ error: 'You can only update your own entree' });

    // Delete all existing sides
    await db.run('DELETE FROM entree_sides WHERE entree_id = ?', [req.params.entreeId]);

    // Insert new sides with sort_order
    for (let i = 0; i < sides.length; i++) {
      const sideName = sides[i].trim();
      if (sideName) {
        await db.run(
          'INSERT INTO entree_sides (id, entree_id, side_name, sort_order) VALUES (?,?,?,?)',
          [uuidv4(), req.params.entreeId, sideName, i]
        );
      }
    }

    // Return updated sides
    const updated = await db.all(
      'SELECT id, side_name, sort_order FROM entree_sides WHERE entree_id = ? ORDER BY sort_order ASC',
      [req.params.entreeId]
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/swaps/:weekId/entrees/:entreeId/sides/:sideId — delete a single side
router.delete('/:weekId/entrees/:entreeId/sides/:sideId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const week = await db.get('SELECT * FROM swap_weeks WHERE id = ?', [req.params.weekId]);
    if (!week) return res.status(404).json({ error: 'Swap week not found' });
    if (!await requireMember(week.group_id, req.user.id))
      return res.status(403).json({ error: 'Not a group member' });

    const side = await db.get('SELECT * FROM entree_sides WHERE id = ?', [req.params.sideId]);
    if (!side) return res.status(404).json({ error: 'Side not found' });

    const entree = await db.get('SELECT * FROM swap_entrees WHERE id = ?', [req.params.entreeId]);
    if (!entree) return res.status(404).json({ error: 'Entree not found' });

    // Only the assigned member (or group admin) can update
    const isAdmin = await requireAdmin(week.group_id, req.user.id);
    if (entree.user_id !== req.user.id && !isAdmin)
      return res.status(403).json({ error: 'You can only update your own entree' });

    await db.run('DELETE FROM entree_sides WHERE id = ?', [req.params.sideId]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
