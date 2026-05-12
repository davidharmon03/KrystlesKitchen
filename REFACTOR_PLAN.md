# Refactor Plan: Meal → Entree + Sides Recommendations

## Overview
Rename all references to "meal" → "entree" throughout the application to better reflect the actual use case (couples batch-prepping freezer-friendly main dishes). Add the ability to attach side dish recommendations to each entree.

## Phase 1: Database Schema Changes

### 1.1 Rename swap_meals table
```sql
-- Backup old table
ALTER TABLE swap_meals RENAME TO swap_meals_backup;

-- Create new table
CREATE TABLE IF NOT EXISTS swap_entrees (
  id         TEXT PRIMARY KEY,
  week_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  entree_name TEXT NOT NULL,  -- renamed from meal_name
  recipe_id  TEXT,
  notes      TEXT DEFAULT '',
  status     TEXT DEFAULT 'assigned',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (week_id)  REFERENCES swap_weeks(id),
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);

-- Copy data
INSERT INTO swap_entrees 
SELECT id, week_id, user_id, meal_name, recipe_id, notes, status, created_at, updated_at 
FROM swap_meals_backup;

-- Update meal_ratings foreign key
ALTER TABLE meal_ratings RENAME TO meal_ratings_backup;

CREATE TABLE IF NOT EXISTS meal_ratings (
  id         TEXT PRIMARY KEY,
  entree_id  TEXT NOT NULL,  -- renamed from meal_id
  rated_by   TEXT NOT NULL,
  stars      INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
  comment    TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(entree_id, rated_by),
  FOREIGN KEY (entree_id)  REFERENCES swap_entrees(id),
  FOREIGN KEY (rated_by)   REFERENCES users(id)
);

INSERT INTO meal_ratings 
SELECT id, meal_id, rated_by, stars, comment, created_at 
FROM meal_ratings_backup;

-- Drop backup tables
DROP TABLE meal_ratings_backup;
DROP TABLE swap_meals_backup;
```

### 1.2 Create entree_sides table
```sql
CREATE TABLE IF NOT EXISTS entree_sides (
  id         TEXT PRIMARY KEY,
  entree_id  TEXT NOT NULL,
  side_name  TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (entree_id) REFERENCES swap_entrees(id) ON DELETE CASCADE
);

CREATE INDEX idx_entree_sides_entree_id ON entree_sides(entree_id);
```

---

## Phase 2: Backend API Changes

### 2.1 Update server/routes/swaps.js

**Rename constants:**
```javascript
// Old: MEAL_SELECT
const ENTREE_SELECT = `
  SELECT se.*, u.name AS user_name, u.avatar_path, r.title AS recipe_title
  FROM swap_entrees se
  JOIN users u ON u.id = se.user_id
  LEFT JOIN recipes r ON r.id = se.recipe_id
  WHERE se.week_id = ?
  ORDER BY u.name ASC
`;
```

**Update route parameters:**
- `GET /api/swaps?group_id=` → stays same (returns `{ week, entrees }`)
- `GET /api/swaps/history?group_id=` → stays same (returns `{ week, entrees }`)
- `POST /api/swaps` → stays same (accepts `entrees` array instead of `meals`)
  - Request body: `meals` → `entrees`
  - Payload fields: `meal_name` → `entree_name`
- `PUT /api/swaps/:weekId/entrees/:entreeId` (was `/meals/:mealId`)
  - Route parameter: `:mealId` → `:entreeId`
  - Request body: `meal_name` → `entree_name`
- `PUT /api/swaps/:weekId/complete` → stays same
- `POST /api/swaps/:weekId/entrees/:entreeId/rate` (was `/meals/:mealId/rate`)
  - Route parameter: `:mealId` → `:entreeId`
- `GET /api/recipes/:recipeId/ratings` → stays same

**New endpoints for sides:**
```javascript
// GET /api/swaps/:weekId/entrees/:entreeId/sides
// POST /api/swaps/:weekId/entrees/:entreeId/sides
// DELETE /api/swaps/:weekId/entrees/:entreeId/sides/:sideId
```

### 2.2 Update server/routes/recipes.js
- Update `POST /api/recipes/import-url` to optionally return `entrees` structure (backwards compat)

---

## Phase 3: Frontend Changes

### 3.1 MealSwap.jsx
**Rename variables:**
- `meals` → `entrees`
- `meal` → `entree`
- `mealRows` → `entreeRows`
- `updateModal` → `updateEntreeModal`

**Update UI text:**
- "Meal Swap" → "Entree Swap" (in header)
- "No meals assigned" → "No entrees assigned"
- "Update Your Meal" → "Update Your Entree"
- "meal_name" fields → "entree_name"
- Placeholders: "Meal name *" → "Entree name *"

**Update state references:**
- `data.meals` → `data.entrees`
- `meals.length` → `entrees.length`

**Update route calls:**
- `/swaps/:weekId/meals/:mealId` → `/swaps/:weekId/entrees/:entreeId`
- `/swaps/:weekId/meals/:mealId/rate` → `/swaps/:weekId/entrees/:entreeId/rate`

**Add sides display:**
- Show sides list in meal card (below entree_name)
- Add sides input in UpdateEntreeModal
- Display sides in past swaps view

### 3.2 Kitchen.jsx
**Update UI text:**
- Descriptions mentioning "meals" → "entrees"
- RecipeModal placeholder: "Meal name" → "Entree name" (if applicable)

### 3.3 RatingModal.jsx
**Update:**
- "Rate This Meal" → "Rate This Entree"
- `meal` prop → `entree` prop
- `meal.meal_name` → `entree.entree_name`
- `meal.user_name` → `entree.user_name`

### 3.4 MealSwap.jsx (CreateSwapModal)
**Update:**
- "Meal Assignments" → "Entree Assignments"
- "Meal name *" → "Entree name *"
- Form field: `mealRows` → `entreeRows`
- Column: "Meal name" → "Entree name"
- Column: "meal_name" → "entree_name"

---

## Phase 4: Sides Feature Implementation

### 4.1 Backend
**Create new endpoint handlers in server/routes/swaps.js:**

```javascript
// GET /api/swaps/:weekId/entrees/:entreeId/sides
// Returns array of sides for an entree

// POST /api/swaps/:weekId/entrees/:entreeId/sides
// Body: { sides: ['side1', 'side2', ...] }
// Replaces all sides for an entree

// DELETE /api/swaps/:weekId/entrees/:entreeId/sides/:sideId
// Removes single side
```

### 4.2 Frontend - Add Sides UI

**In CreateSwapModal:**
- Add "Suggested sides (optional)" input below meal/entree name
- Textarea or comma-separated list input
- Store as array in form state

**In UpdateEntreeModal:**
- Display current sides
- Allow adding/removing sides
- Simple list UI with delete buttons per side

**In past swaps view:**
- Display sides list below entree name
- Format: "Sides: roasted veggies, rice pilaf"

**In Kitchen recipe cards:**
- Add section for sides recommendations
- Display below tags/author
- Optional: "★ 4.2 · Sides: ..."

### 4.3 RatingDisplay integration
- Keep existing rating display
- No changes needed (ratings stay per entree)

---

## Phase 5: Testing Checklist

### Database
- [ ] Migration runs without errors
- [ ] Data copies correctly (meal → entree)
- [ ] Foreign keys work
- [ ] Entree_sides table created
- [ ] Old tables dropped

### API
- [ ] GET /swaps returns entrees instead of meals
- [ ] POST /swaps accepts entrees array
- [ ] PUT /swaps/:weekId/entrees/:entreeId works
- [ ] Rating endpoints work with new entree_id foreign key
- [ ] New sides endpoints respond correctly

### Frontend
- [ ] MealSwap page loads active entrees
- [ ] Can create new swap week with entrees
- [ ] Can update entree status
- [ ] Can add/edit sides
- [ ] Sides display correctly in all views
- [ ] Ratings still work (with new endpoints)
- [ ] Kitchen recipe cards show ratings
- [ ] Past swaps show entrees + sides

---

## Implementation Order

1. **Step 1:** Database migration (Phase 1)
2. **Step 2:** Backend route updates (Phase 2)
3. **Step 3:** Frontend updates (Phase 3)
4. **Step 4:** Sides feature (Phase 4)
5. **Step 5:** Testing & QA (Phase 5)

---

## Backwards Compatibility Notes

- All API responses change structure (`meals` → `entrees`)
- Frontend will need simultaneous update (no versioning gap possible)
- Mobile testing deferred until PWA/deployment phase anyway

---

## Files to Modify

**Database:**
- `server/db.js` - schema

**Backend:**
- `server/routes/swaps.js` - all endpoints

**Frontend:**
- `client/src/pages/MealSwap.jsx` - main page + modals
- `client/src/components/RatingModal.jsx` - update prop/text
- `client/src/pages/Kitchen.jsx` - if applicable
- `client/src/components/RatingDisplay.jsx` - optional updates

**Documentation:**
- `RECIPE_IMPORT_URL.md` - if mentions meal structure
- Update README/API docs

---

## Estimated Effort

- Database migration: 30 min
- Backend routes: 1 hour
- Frontend updates: 1.5 hours
- Sides feature: 1.5 hours
- Testing: 1 hour
- **Total: ~5.5 hours**

