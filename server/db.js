const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data.db');
let _dbPromise = null;

async function getDb() {
  if (!_dbPromise) _dbPromise = _init();
  return _dbPromise;
}

async function _init() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.run('PRAGMA journal_mode = WAL');
  await db.run('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS groups (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      owner_id    TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS group_members (
      id        TEXT PRIMARY KEY,
      group_id  TEXT NOT NULL,
      user_id   TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (user_id)  REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS group_invitations (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      email      TEXT NOT NULL,
      token      TEXT UNIQUE NOT NULL,
      status     TEXT DEFAULT 'pending',
      invited_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id)   REFERENCES groups(id),
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      ingredients TEXT NOT NULL,
      steps       TEXT NOT NULL,
      tags        TEXT DEFAULT '[]',
      skill_tags  TEXT DEFAULT '[]',
      author_id   TEXT NOT NULL,
      group_id    TEXT,
      is_public   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (group_id)  REFERENCES groups(id)
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id          TEXT PRIMARY KEY,
      group_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      amount      REAL NOT NULL,
      description TEXT,
      image_path  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (user_id)  REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS meal_credits (
      id          TEXT PRIMARY KEY,
      group_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      credits     REAL NOT NULL DEFAULT 0,
      description TEXT,
      added_by    TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (user_id)  REFERENCES users(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS inventory_items (
      id           TEXT PRIMARY KEY,
      group_id     TEXT NOT NULL,
      name         TEXT NOT NULL,
      quantity     TEXT NOT NULL,
      category     TEXT NOT NULL,
      storage_type TEXT NOT NULL,
      notes        TEXT,
      use_by_date  TEXT,
      added_by     TEXT NOT NULL,
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      name       TEXT NOT NULL,
      quantity   TEXT,
      category   TEXT,
      is_checked INTEGER DEFAULT 0,
      added_by   TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS vacuum_seal_log (
      id               TEXT PRIMARY KEY,
      group_id         TEXT NOT NULL,
      item_name        TEXT NOT NULL,
      quantity         TEXT,
      seal_date        TEXT NOT NULL,
      expiry_date      TEXT,
      use_by_date      TEXT,
      storage_location TEXT,
      notes            TEXT,
      added_by         TEXT NOT NULL,
      created_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS garden_plants (
      id               TEXT PRIMARY KEY,
      group_id         TEXT NOT NULL,
      plant_name       TEXT NOT NULL,
      date_planted     TEXT NOT NULL,
      expected_harvest TEXT,
      status           TEXT DEFAULT 'growing',
      notes            TEXT,
      added_by         TEXT NOT NULL,
      created_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS harvest_logs (
      id                 TEXT PRIMARY KEY,
      group_id           TEXT NOT NULL,
      plant_id           TEXT,
      plant_name         TEXT NOT NULL,
      harvest_date       TEXT NOT NULL,
      yield_amount       TEXT NOT NULL,
      notes              TEXT,
      added_to_inventory INTEGER DEFAULT 0,
      added_by           TEXT NOT NULL,
      created_at         TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (plant_id) REFERENCES garden_plants(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS seasonal_calendar (
      id          TEXT PRIMARY KEY,
      group_id    TEXT NOT NULL,
      title       TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      start_date  TEXT NOT NULL,
      end_date    TEXT,
      description TEXT,
      added_by    TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS equipment_catalog (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      category       TEXT NOT NULL,
      brand          TEXT,
      description    TEXT,
      image_url      TEXT,
      purchase_url   TEXT,
      is_recommended INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS group_equipment (
      id              TEXT PRIMARY KEY,
      group_id        TEXT NOT NULL,
      catalog_item_id TEXT,
      custom_name     TEXT,
      quantity        INTEGER DEFAULT 1,
      owner_user_id   TEXT,
      condition       TEXT DEFAULT 'good',
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id)        REFERENCES groups(id),
      FOREIGN KEY (catalog_item_id) REFERENCES equipment_catalog(id),
      FOREIGN KEY (owner_user_id)   REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS container_fleet (
      id             TEXT PRIMARY KEY,
      group_id       TEXT NOT NULL,
      container_type TEXT NOT NULL,
      supply_type    TEXT DEFAULT 'container',
      size_capacity  TEXT,
      material       TEXT,
      description    TEXT,
      purchase_url   TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );
    CREATE TABLE IF NOT EXISTS bulk_buy_runs (
      id             TEXT PRIMARY KEY,
      group_id       TEXT NOT NULL,
      name           TEXT NOT NULL,
      run_date       TEXT,
      buyer_user_id  TEXT,
      status         TEXT DEFAULT 'planning',
      created_by     TEXT NOT NULL,
      created_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id)      REFERENCES groups(id),
      FOREIGN KEY (buyer_user_id) REFERENCES users(id),
      FOREIGN KEY (created_by)    REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS bulk_buy_items (
      id              TEXT PRIMARY KEY,
      run_id          TEXT NOT NULL,
      group_id        TEXT NOT NULL,
      item_name       TEXT NOT NULL,
      category        TEXT DEFAULT 'other',
      requested_by    TEXT NOT NULL,
      quantity_needed TEXT,
      est_cost        REAL,
      actual_cost     REAL,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (run_id)       REFERENCES bulk_buy_runs(id),
      FOREIGN KEY (group_id)     REFERENCES groups(id),
      FOREIGN KEY (requested_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS products (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      brand              TEXT,
      category           TEXT DEFAULT 'other',
      store_section      TEXT DEFAULT 'pantry',
      unit_type          TEXT,
      unit_size          TEXT,
      description        TEXT,
      image_url          TEXT,
      image_path         TEXT,
      barcode            TEXT,
      source             TEXT DEFAULT 'custom',
      off_id             TEXT,
      created_by_user_id TEXT,
      is_public          INTEGER DEFAULT 1,
      created_at         TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id           TEXT PRIMARY KEY,
      group_id     TEXT NOT NULL,
      name         TEXT NOT NULL DEFAULT 'Weekly Shop',
      created_at   TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );
    CREATE TABLE IF NOT EXISTS meal_photos (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL,
      group_id          TEXT NOT NULL,
      recipe_id         TEXT,
      inventory_item_id TEXT,
      vacuum_seal_id    TEXT,
      image_path        TEXT NOT NULL,
      caption           TEXT DEFAULT '',
      stage             TEXT DEFAULT 'plated',
      created_at        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id)  REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );
  `);

  // Plant guide library
  await db.exec(`
    CREATE TABLE IF NOT EXISTS plant_guides (
      id                            INTEGER PRIMARY KEY AUTOINCREMENT,
      common_name                   TEXT NOT NULL,
      scientific_name               TEXT,
      type                          TEXT NOT NULL DEFAULT 'vegetable',
      description                   TEXT,
      planting_seasons              TEXT DEFAULT '[]',
      usda_zones                    TEXT,
      days_to_germinate             INTEGER,
      days_to_harvest               INTEGER,
      space_needed_sqft             REAL,
      spacing_between_plants_inches INTEGER,
      row_spacing_inches            INTEGER,
      sunlight                      TEXT DEFAULT 'full_sun',
      water_frequency               TEXT,
      soil_type                     TEXT,
      companion_plants              TEXT DEFAULT '[]',
      avoid_planting_with           TEXT DEFAULT '[]',
      tips                          TEXT,
      image_url                     TEXT,
      resource_links                TEXT DEFAULT '[]',
      created_at                    TEXT DEFAULT (datetime('now'))
    );
  `);

  // New tables (notifications, swap)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      group_id   TEXT,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      message    TEXT,
      link       TEXT,
      is_read    INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id)  REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );
    CREATE TABLE IF NOT EXISTS swap_schedule (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      week_start TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, week_start),
      FOREIGN KEY (group_id)   REFERENCES groups(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS swap_assignments (
      id            TEXT PRIMARY KEY,
      schedule_id   TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      day_of_week   INTEGER NOT NULL,
      recipe_id     TEXT,
      meal_name     TEXT NOT NULL DEFAULT '',
      notes         TEXT,
      delivery_date TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (schedule_id) REFERENCES swap_schedule(id),
      FOREIGN KEY (user_id)     REFERENCES users(id),
      FOREIGN KEY (recipe_id)   REFERENCES recipes(id)
    );
    CREATE TABLE IF NOT EXISTS swap_weeks (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      swap_day   TEXT NOT NULL,
      week_label TEXT DEFAULT '',
      status     TEXT DEFAULT 'active',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id)   REFERENCES groups(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS swap_meals (
      id         TEXT PRIMARY KEY,
      week_id    TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      meal_name  TEXT NOT NULL,
      recipe_id  TEXT,
      status     TEXT DEFAULT 'assigned',
      notes      TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (week_id)   REFERENCES swap_weeks(id),
      FOREIGN KEY (user_id)   REFERENCES users(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );
    CREATE TABLE IF NOT EXISTS meal_ratings (
      id         TEXT PRIMARY KEY,
      meal_id    TEXT NOT NULL,
      rated_by   TEXT NOT NULL,
      stars      INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
      comment    TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(meal_id, rated_by),
      FOREIGN KEY (meal_id)   REFERENCES swap_meals(id),
      FOREIGN KEY (rated_by)  REFERENCES users(id)
    );
  `);

  // Suggestions & feature request tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS meal_suggestions (
      id                   TEXT PRIMARY KEY,
      group_id             TEXT NOT NULL,
      suggested_by_user_id TEXT NOT NULL,
      meal_name            TEXT NOT NULL,
      recipe_id            TEXT,
      description          TEXT DEFAULT '',
      status               TEXT DEFAULT 'open',
      created_at           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id)             REFERENCES groups(id),
      FOREIGN KEY (suggested_by_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS suggestion_votes (
      id            TEXT PRIMARY KEY,
      suggestion_id TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      vote          TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(suggestion_id, user_id),
      FOREIGN KEY (suggestion_id) REFERENCES meal_suggestions(id),
      FOREIGN KEY (user_id)       REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS feature_requests (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      category    TEXT DEFAULT 'other',
      status      TEXT DEFAULT 'submitted',
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS feature_request_votes (
      id         TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(request_id, user_id),
      FOREIGN KEY (request_id) REFERENCES feature_requests(id),
      FOREIGN KEY (user_id)    REFERENCES users(id)
    );
  `);

  // Phase 1 Migration: Rename swap_meals to swap_entrees
  const _mealTableExists = await db.all(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='swap_meals'
  `);

  if (_mealTableExists.length > 0) {
    const _entreeTableExists = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='swap_entrees'
    `);

    if (_entreeTableExists.length === 0) {
      // Backup old table
      await db.run('ALTER TABLE swap_meals RENAME TO swap_meals_backup');

      // Create new table
      await db.run(`
        CREATE TABLE IF NOT EXISTS swap_entrees (
          id         TEXT PRIMARY KEY,
          week_id    TEXT NOT NULL,
          user_id    TEXT NOT NULL,
          entree_name TEXT NOT NULL,
          recipe_id  TEXT,
          notes      TEXT DEFAULT '',
          status     TEXT DEFAULT 'assigned',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (week_id)  REFERENCES swap_weeks(id),
          FOREIGN KEY (user_id)  REFERENCES users(id),
          FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        )
      `);

      // Copy data
      await db.run(`
        INSERT INTO swap_entrees (id, week_id, user_id, entree_name, recipe_id, notes, status, created_at, updated_at)
        SELECT id, week_id, user_id, meal_name, recipe_id, notes, status, datetime('now'), updated_at
        FROM swap_meals_backup
      `);

      // Update meal_ratings foreign key
      const _ratingsBackupExists = await db.all(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='meal_ratings_backup'
      `);

      if (_ratingsBackupExists.length === 0) {
        await db.run('ALTER TABLE meal_ratings RENAME TO meal_ratings_backup');

        await db.run(`
          CREATE TABLE IF NOT EXISTS meal_ratings (
            id         TEXT PRIMARY KEY,
            entree_id  TEXT NOT NULL,
            rated_by   TEXT NOT NULL,
            stars      INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
            comment    TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(entree_id, rated_by),
            FOREIGN KEY (entree_id)  REFERENCES swap_entrees(id),
            FOREIGN KEY (rated_by)   REFERENCES users(id)
          )
        `);

        await db.run(`
          INSERT INTO meal_ratings
          SELECT id, meal_id, rated_by, stars, comment, created_at
          FROM meal_ratings_backup
        `);
      }

      // Create entree_sides table
      await db.run(`
        CREATE TABLE IF NOT EXISTS entree_sides (
          id         TEXT PRIMARY KEY,
          entree_id  TEXT NOT NULL,
          side_name  TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (entree_id) REFERENCES swap_entrees(id) ON DELETE CASCADE
        )
      `);

      await db.run(`
        CREATE INDEX idx_entree_sides_entree_id ON entree_sides(entree_id)
      `);

      // Drop backup tables
      await db.run('DROP TABLE IF EXISTS meal_ratings_backup');
      await db.run('DROP TABLE IF EXISTS swap_meals_backup');
    }
  }

  // Migrations: add columns to existing databases
  const _invCols = await db.all('PRAGMA table_info(inventory_items)');
  if (!_invCols.find(c => c.name === 'use_by_date')) {
    await db.run('ALTER TABLE inventory_items ADD COLUMN use_by_date TEXT');
  }
  const _vsCols = await db.all('PRAGMA table_info(vacuum_seal_log)');
  if (!_vsCols.find(c => c.name === 'use_by_date')) {
    await db.run('ALTER TABLE vacuum_seal_log ADD COLUMN use_by_date TEXT');
  }

  // shopping_list_items migrations
  const _slCols = await db.all('PRAGMA table_info(shopping_list_items)');
  const _slColNames = _slCols.map(c => c.name);
  if (!_slColNames.includes('product_id'))   await db.run('ALTER TABLE shopping_list_items ADD COLUMN product_id TEXT');
  if (!_slColNames.includes('unit'))         await db.run('ALTER TABLE shopping_list_items ADD COLUMN unit TEXT');
  if (!_slColNames.includes('store_section'))await db.run('ALTER TABLE shopping_list_items ADD COLUMN store_section TEXT');
  if (!_slColNames.includes('list_id'))      await db.run('ALTER TABLE shopping_list_items ADD COLUMN list_id TEXT');

  // inventory_items migrations
  const _invCols2 = await db.all('PRAGMA table_info(inventory_items)');
  const _invColNames = _invCols2.map(c => c.name);
  if (!_invColNames.includes('product_id'))        await db.run('ALTER TABLE inventory_items ADD COLUMN product_id TEXT');
  if (!_invColNames.includes('product_image_url')) await db.run('ALTER TABLE inventory_items ADD COLUMN product_image_url TEXT');

  // vacuum_seal_log migrations
  const _vsCols2 = await db.all('PRAGMA table_info(vacuum_seal_log)');
  const _vsColNames = _vsCols2.map(c => c.name);
  if (!_vsColNames.includes('product_id'))        await db.run('ALTER TABLE vacuum_seal_log ADD COLUMN product_id TEXT');
  if (!_vsColNames.includes('product_image_url')) await db.run('ALTER TABLE vacuum_seal_log ADD COLUMN product_image_url TEXT');

  // bulk_buy_items migrations
  const _bbCols = await db.all('PRAGMA table_info(bulk_buy_items)');
  if (!_bbCols.find(c => c.name === 'product_id'))        await db.run('ALTER TABLE bulk_buy_items ADD COLUMN product_id TEXT');
  if (!_bbCols.find(c => c.name === 'product_image_url')) await db.run('ALTER TABLE bulk_buy_items ADD COLUMN product_image_url TEXT');

  // users migrations
  const _userCols = await db.all('PRAGMA table_info(users)');
  if (!_userCols.find(c => c.name === 'social_links'))  await db.run("ALTER TABLE users ADD COLUMN social_links TEXT DEFAULT '{}'");
  if (!_userCols.find(c => c.name === 'avatar_path'))   await db.run("ALTER TABLE users ADD COLUMN avatar_path TEXT");
  if (!_userCols.find(c => c.name === 'role'))          await db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'");

  // garden_plants migration: plant_guide_id FK
  const _gpCols = await db.all('PRAGMA table_info(garden_plants)');
  if (!_gpCols.find(c => c.name === 'plant_guide_id')) {
    await db.run('ALTER TABLE garden_plants ADD COLUMN plant_guide_id INTEGER');
  }

  // recipes migration: sides field
  const _recipeCols = await db.all('PRAGMA table_info(recipes)');
  if (!_recipeCols.find(c => c.name === 'sides')) {
    await db.run("ALTER TABLE recipes ADD COLUMN sides TEXT DEFAULT ''");
  }

  // Orders: menu_items + meal_requests
  await db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id          TEXT PRIMARY KEY,
      recipe_id   TEXT REFERENCES recipes(id) ON DELETE CASCADE,
      group_id    TEXT REFERENCES groups(id),
      available   INTEGER DEFAULT 1,
      price       TEXT DEFAULT '',
      note        TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS meal_requests (
      id           TEXT PRIMARY KEY,
      menu_item_id TEXT REFERENCES menu_items(id),
      group_id     TEXT REFERENCES groups(id),
      requester_id TEXT REFERENCES users(id),
      quantity     INTEGER DEFAULT 1,
      note         TEXT DEFAULT '',
      status       TEXT DEFAULT 'pending',
      requested_at TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // Security: password reset tokens + refresh tokens
  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used       INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked    INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Group Chat
  await db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      deleted    INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Notification preferences JSON column on users
  try {
    await db.run(`ALTER TABLE users ADD COLUMN notification_prefs TEXT DEFAULT '{}'`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Group Sync Mode
  try {
    await db.run(`ALTER TABLE users ADD COLUMN sync_mode TEXT DEFAULT 'auto'`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    await db.run(`ALTER TABLE group_members ADD COLUMN last_synced_at DATETIME`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Security: must_change_password flag on users
  try {
    await db.run(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Payment Integration: plan + Stripe fields on users
  try {
    await db.run(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    await db.run(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    await db.run(`ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  await _seed(db);
  await _seedProducts(db);
  await _seedPlantGuides(db);
  return db;
}

async function _seed(db) {
  const existing = await db.get('SELECT id FROM users LIMIT 1');
  if (existing) return;

  console.log('Seeding database...');
  const pw = bcrypt.hashSync('password123', 10);

  const krystle = { id: uuidv4(), name: 'Krystle', email: 'krystle@example.com', password: pw };
  const marcus  = { id: uuidv4(), name: 'Marcus',  email: 'marcus@example.com',  password: pw };
  const dana    = { id: uuidv4(), name: 'Dana',    email: 'dana@example.com',    password: pw };

  for (const u of [krystle, marcus, dana]) {
    await db.run('INSERT INTO users (id, name, email, password) VALUES (?,?,?,?)',
      [u.id, u.name, u.email, u.password]);
  }

  const group = { id: uuidv4(), name: "Krystle's Crew", invite_code: 'KREW2024', owner_id: krystle.id };
  await db.run('INSERT INTO groups (id, name, invite_code, owner_id) VALUES (?,?,?,?)',
    [group.id, group.name, group.invite_code, group.owner_id]);
  for (const uid of [krystle.id, marcus.id, dana.id]) {
    await db.run('INSERT INTO group_members (id, group_id, user_id) VALUES (?,?,?)',
      [uuidv4(), group.id, uid]);
  }

  // Recipes
  const recipes = [
    {
      title: 'Flash-Frozen Garlic Herb Steak', description: 'Perfectly seasoned ribeye, flash frozen and vacuum sealed for the swap.',
      ingredients: JSON.stringify(['2 ribeye steaks','4 cloves garlic','2 tbsp fresh rosemary','2 tbsp butter','Salt & pepper']),
      steps: JSON.stringify(['Season steaks generously','Sear 2 min per side in cast iron','Baste with garlic butter','Flash freeze 2h, then vacuum seal']),
      tags: JSON.stringify(['beef','freezer-friendly','high-protein']), skill_tags: JSON.stringify(['intermediate']),
    },
    {
      title: 'Roasted Tomato Basil Sauce', description: 'Garden-fresh tomatoes slow roasted into a rich sauce. Freezes beautifully.',
      ingredients: JSON.stringify(['2 lbs heirloom tomatoes','1 head garlic','Fresh basil','1/4 cup olive oil','Sea salt']),
      steps: JSON.stringify(['Halve tomatoes, roast at 375F for 45 min','Blend with garlic and basil','Simmer 10 min','Portion and freeze']),
      tags: JSON.stringify(['vegetarian','garden','freezer-friendly']), skill_tags: JSON.stringify(['beginner']),
    },
    {
      title: 'Bone Broth Concentrate', description: 'Slow-simmered for 24h. Rich, gelatinous, and packed with minerals.',
      ingredients: JSON.stringify(['3 lbs mixed bones','2 tbsp apple cider vinegar','Bay leaves','Peppercorns','Filtered water']),
      steps: JSON.stringify(['Roast bones at 400F for 30 min','Add all to slow cooker with water and ACV','Cook on low 24h','Strain and reduce by half, freeze in cubes']),
      tags: JSON.stringify(['keto','healing','freezer-friendly']), skill_tags: JSON.stringify(['beginner']),
    },
  ];
  for (const r of recipes) {
    await db.run(
      'INSERT INTO recipes (id,title,description,ingredients,steps,tags,skill_tags,author_id,group_id,is_public) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), r.title, r.description, r.ingredients, r.steps, r.tags, r.skill_tags, krystle.id, group.id, 1]
    );
  }

  // Inventory
  const items = [
    { name: 'Grass-Fed Ribeye',  quantity: '4 steaks', category: 'protein',  storage_type: 'vacuum sealed', added_by: krystle.id },
    { name: 'Heirloom Tomatoes', quantity: '2 lbs',    category: 'produce',  storage_type: 'fresh',         added_by: krystle.id },
    { name: 'Raw Honey',         quantity: '1 qt jar', category: 'pantry',   storage_type: 'pantry',        added_by: marcus.id  },
    { name: 'Bone Broth',        quantity: '8 cups',   category: 'staple',   storage_type: 'frozen',        added_by: krystle.id },
  ];
  for (const i of items) {
    await db.run('INSERT INTO inventory_items (id,group_id,name,quantity,category,storage_type,added_by) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), group.id, i.name, i.quantity, i.category, i.storage_type, i.added_by]);
  }

  // Garden
  const plants = [
    { plant_name: 'Heirloom Tomatoes', date_planted: '2024-04-01', expected_harvest: '2024-07-15', status: 'growing',    added_by: krystle.id },
    { plant_name: 'Sweet Basil',       date_planted: '2024-04-10', expected_harvest: '2024-06-01', status: 'harvesting', added_by: krystle.id },
    { plant_name: 'Kale',              date_planted: '2024-03-15', expected_harvest: '2024-05-30', status: 'harvested',  added_by: dana.id    },
  ];
  for (const p of plants) {
    await db.run('INSERT INTO garden_plants (id,group_id,plant_name,date_planted,expected_harvest,status,added_by) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), group.id, p.plant_name, p.date_planted, p.expected_harvest, p.status, p.added_by]);
  }

  // Receipts
  await db.run('INSERT INTO receipts (id,group_id,user_id,amount,description) VALUES (?,?,?,?,?)',
    [uuidv4(), group.id, krystle.id, 87.50, 'Whole Foods — proteins for the week']);
  await db.run('INSERT INTO receipts (id,group_id,user_id,amount,description) VALUES (?,?,?,?,?)',
    [uuidv4(), group.id, marcus.id, 42.00, "Farmer's market haul"]);

  // Equipment catalog
  const catalog = [
    { name: 'FoodSaver FM2000 Vacuum Sealer', category: 'hardware', brand: 'FoodSaver',
      description: 'Compact automatic vacuum sealer. Removes air and seals bags to keep food fresh up to 5x longer. Essential for the meal swap program.',
      purchase_url: 'https://www.foodsaver.com', is_recommended: 1 },
    { name: 'Midea 7.0 Cu Ft Chest Freezer', category: 'hardware', brand: 'Midea',
      description: 'Deep chest freezer ideal for storing large batch meals and proteins. Fits neatly in a garage or basement.',
      purchase_url: 'https://www.amazon.com', is_recommended: 1 },
    { name: 'DYMO LabelWriter 450', category: 'hardware', brand: 'DYMO',
      description: 'Direct thermal label printer. No ink cartridges needed. Prints adhesive labels for vacuum bags, jars, and containers.',
      purchase_url: 'https://www.dymo.com', is_recommended: 1 },
    { name: 'Escali Primo Digital Kitchen Scale', category: 'hardware', brand: 'Escali',
      description: 'Accurate to 1g, 11 lb capacity. Essential for portioning recipes consistently across the group.',
      purchase_url: 'https://www.amazon.com', is_recommended: 1 },
    { name: 'Pyrex Simply Store 18-pc Glass Set', category: 'storage_containers', brand: 'Pyrex',
      description: 'The standard uniform container fleet. Borosilicate glass, freezer-to-oven safe. Standardizing on these ensures lids are interchangeable across all 5 households.',
      purchase_url: 'https://www.amazon.com', is_recommended: 1 },
    { name: 'Ball Wide-Mouth Mason Jars 32oz (12-pk)', category: 'storage_containers', brand: 'Ball',
      description: 'Wide-mouth quart jars for soups, broths, sauces, and dry goods. Stackable and airtight.',
      purchase_url: 'https://www.amazon.com', is_recommended: 1 },
    { name: 'OXO Good Grips 10-pc POP Container Set', category: 'storage_containers', brand: 'OXO',
      description: 'Airtight push-to-open containers for pantry staples — grains, flours, nuts. Stackable with uniform footprint.',
      purchase_url: 'https://www.oxo.com', is_recommended: 0 },
    { name: 'FoodSaver Gallon Vacuum Bags (28-pk)', category: 'expendables', brand: 'FoodSaver',
      description: 'BPA-free vacuum seal bags compatible with FoodSaver and most channel-style sealers. Reusable up to 3x if contents were dry.',
      purchase_url: 'https://www.foodsaver.com', is_recommended: 1 },
    { name: 'Reynolds Wrap Unbleached Parchment Paper (100 sq ft)', category: 'expendables', brand: 'Reynolds',
      description: 'Unbleached, non-stick parchment for flash-freezing individual portions before vacuum sealing. Prevents items from sticking together.',
      purchase_url: 'https://www.amazon.com', is_recommended: 1 },
    { name: 'Ziploc Freezer Bags Gallon (30-pk)', category: 'expendables', brand: 'Ziploc',
      description: 'Heavy-duty freezer bags for items that don\'t require a full vacuum seal. Double zipper, BPA-free.',
      purchase_url: 'https://www.amazon.com', is_recommended: 0 },
    { name: 'Avery Removable Square Labels 2" (60-pk)', category: 'expendables', brand: 'Avery',
      description: 'White removable labels that peel cleanly off glass and plastic. Ideal for dating and labeling containers in the rotation fleet.',
      purchase_url: 'https://www.avery.com', is_recommended: 1 },
    { name: 'Sharpie Fine-Tip Permanent Markers (12-pk)', category: 'expendables', brand: 'Sharpie',
      description: 'For writing directly on vacuum bags — date, contents, cook instructions. Fine tip fits the label area on standard bags.',
      purchase_url: 'https://www.amazon.com', is_recommended: 0 },
  ];
  for (const c of catalog) {
    await db.run(
      'INSERT INTO equipment_catalog (id,name,category,brand,description,image_url,purchase_url,is_recommended) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), c.name, c.category, c.brand || '', c.description || '', c.image_url || '', c.purchase_url || '', c.is_recommended]
    );
  }

  // Seed group equipment from catalog items
  const foodsaver = await db.get("SELECT id FROM equipment_catalog WHERE name LIKE '%FoodSaver FM2000%'");
  const pyrex     = await db.get("SELECT id FROM equipment_catalog WHERE name LIKE '%Pyrex%'");
  const scale     = await db.get("SELECT id FROM equipment_catalog WHERE name LIKE '%Escali%'");
  if (foodsaver) {
    await db.run('INSERT INTO group_equipment (id,group_id,catalog_item_id,quantity,owner_user_id,condition,notes) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), group.id, foodsaver.id, 1, krystle.id, 'good', 'Bought March 2024, works great']);
  }
  if (pyrex) {
    await db.run('INSERT INTO group_equipment (id,group_id,catalog_item_id,quantity,owner_user_id,condition,notes) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), group.id, pyrex.id, 2, krystle.id, 'good', '2 full sets — enough for rotation']);
    await db.run('INSERT INTO group_equipment (id,group_id,catalog_item_id,quantity,owner_user_id,condition,notes) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), group.id, pyrex.id, 1, marcus.id, 'fair', 'Missing 2 lids']);
  }
  if (scale) {
    await db.run('INSERT INTO group_equipment (id,group_id,catalog_item_id,quantity,owner_user_id,condition,notes) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), group.id, scale.id, 1, dana.id, 'good', '']);
  }

  // Seed standard container reference list
  await db.run('INSERT INTO container_fleet (id,group_id,container_type,supply_type,size_capacity,material,description,purchase_url) VALUES (?,?,?,?,?,?,?,?)',
    [uuidv4(), group.id, '32oz Pyrex Glass Meal Prep Container', 'container', '32 oz', 'Borosilicate Glass',
     'Standard entrée container for the meal swap rotation. Freezer-to-oven safe, lids are interchangeable across sets.',
     'https://www.amazon.com/s?k=pyrex+simply+store+glass']);
  await db.run('INSERT INTO container_fleet (id,group_id,container_type,supply_type,size_capacity,material,description,purchase_url) VALUES (?,?,?,?,?,?,?,?)',
    [uuidv4(), group.id, 'Quart Wide-Mouth Mason Jar', 'container', '1 qt / 32 oz', 'Glass',
     'For soups, broths, and sauces. Wide-mouth Ball jars — all couples should use same brand so lids work across households.',
     'https://www.amazon.com/s?k=ball+wide+mouth+mason+jar+quart']);
  await db.run('INSERT INTO container_fleet (id,group_id,container_type,supply_type,size_capacity,material,description,purchase_url) VALUES (?,?,?,?,?,?,?,?)',
    [uuidv4(), group.id, 'Gallon FoodSaver Vacuum Bag', 'consumable', '1 gallon', 'BPA-Free Plastic',
     'For large protein cuts, bulk grains, and anything that benefits from full vacuum sealing.',
     'https://www.foodsaver.com']);

  // Consumable standard supplies
  const consumables = [
    { container_type: "Reynolds Unbleached Parchment Paper", size_capacity: "100 sq ft roll", material: "Unbleached Paper",
      description: "For flash-freezing individual portions before vacuum sealing. Prevents sticking. Everyone should keep a roll.",
      purchase_url: "https://www.amazon.com/s?k=reynolds+unbleached+parchment+paper" },
    { container_type: "Ziploc Freezer Bags (Gallon, 30-pk)", size_capacity: "1 gallon", material: "BPA-Free Plastic",
      description: "For items that don't need a full vacuum seal. Double-seal zipper. Standard gallon size only — no quart bags in the rotation to keep labeling consistent.",
      purchase_url: "https://www.amazon.com/s?k=ziploc+freezer+bags+gallon" },
    { container_type: 'Avery Removable Square Labels 2" (60-pk)', size_capacity: '2" x 2"', material: 'Paper / Adhesive',
      description: "Removable labels for dating containers. Peel cleanly off glass and plastic. Use for anything not going in the vacuum sealer.",
      purchase_url: "https://www.avery.com" },
  ];
  for (const c of consumables) {
    await db.run(
      'INSERT INTO container_fleet (id,group_id,container_type,supply_type,size_capacity,material,description,purchase_url) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), group.id, c.container_type, 'consumable', c.size_capacity, c.material, c.description, c.purchase_url]
    );
  }

  // Sample bulk buy run
  const runId = uuidv4();
  await db.run(
    "INSERT INTO bulk_buy_runs (id,group_id,name,run_date,buyer_user_id,status,created_by) VALUES (?,?,?,?,?,?,?)",
    [runId, group.id, "Sam's Club April Run", "2024-04-20", krystle.id, 'planning', krystle.id]
  );
  const bulkItems = [
    { item_name: "Organic Garlic (3 lb bag)", category: "produce", requested_by: krystle.id, quantity_needed: "2 bags", est_cost: 12.00 },
    { item_name: "Extra Virgin Olive Oil (2 L)", category: "condiment", requested_by: marcus.id, quantity_needed: "1 bottle", est_cost: 18.00 },
    { item_name: "FoodSaver Gallon Bags (28-pk)", category: "consumables", requested_by: krystle.id, quantity_needed: "2 boxes", est_cost: 28.00 },
    { item_name: "FoodSaver Gallon Bags (28-pk)", category: "consumables", requested_by: dana.id, quantity_needed: "1 box", est_cost: 14.00 },
    { item_name: "Sea Salt (5 lb bag)", category: "staple", requested_by: marcus.id, quantity_needed: "1 bag", est_cost: 8.00 },
  ];
  for (const bi of bulkItems) {
    await db.run(
      "INSERT INTO bulk_buy_items (id,run_id,group_id,item_name,category,requested_by,quantity_needed,est_cost) VALUES (?,?,?,?,?,?,?,?)",
      [uuidv4(), runId, group.id, bi.item_name, bi.category, bi.requested_by, bi.quantity_needed, bi.est_cost]
    );
  }

  console.log('Seed complete. Login: krystle@example.com / password123');
}

async function _seedProducts(db) {
  const count = await db.get('SELECT COUNT(*) as n FROM products');
  if (count.n > 0) return;

  console.log('Seeding products catalog...');
  const products = [
    { name: 'Organic Garlic', brand: 'Generic', category: 'produce', store_section: 'produce', unit_type: 'lb', unit_size: '3 lb bag', description: 'Bulk organic garlic heads. Staple for almost every recipe.' },
    { name: 'Extra Virgin Olive Oil', brand: 'Generic', category: 'pantry', store_section: 'pantry', unit_type: 'bottle', unit_size: '2 L', description: 'Cold-pressed EVOO for cooking and finishing.' },
    { name: 'Fine Sea Salt', brand: 'Generic', category: 'pantry', store_section: 'pantry', unit_type: 'lb', unit_size: '5 lb bag', description: 'Fine-grain sea salt. Bulk purchase staple.' },
    { name: 'FoodSaver Gallon Vacuum Bags', brand: 'FoodSaver', category: 'household', store_section: 'household', unit_type: 'pack', unit_size: '28-pack', description: 'BPA-free gallon vacuum seal bags for the FoodSaver.' },
    { name: 'Reynolds Unbleached Parchment Paper', brand: 'Reynolds', category: 'household', store_section: 'household', unit_type: 'roll', unit_size: '100 sq ft', description: 'Unbleached parchment for flash-freezing portions.' },
    { name: 'Ball Wide-Mouth Mason Jars 32oz', brand: 'Ball', category: 'household', store_section: 'household', unit_type: 'pack', unit_size: '12-pack', description: 'Standard quart mason jars for soups, broths, and sauces.' },
    { name: 'Long-Grain White Rice', brand: 'Generic', category: 'pantry', store_section: 'bulk', unit_type: 'lb', unit_size: '25 lb bag', description: 'Bulk white rice. Buy at warehouse stores.' },
    { name: 'Rolled Oats', brand: 'Generic', category: 'pantry', store_section: 'bulk', unit_type: 'lb', unit_size: '10 lb bag', description: 'Old-fashioned rolled oats. Bulk staple.' },
    { name: 'Dried Black Beans', brand: 'Generic', category: 'pantry', store_section: 'bulk', unit_type: 'lb', unit_size: '5 lb bag', description: 'Dried black beans. Soak overnight before cooking.' },
    { name: 'Boneless Chicken Breast', brand: 'Generic', category: 'meat_seafood', store_section: 'meat', unit_type: 'lb', unit_size: 'per lb', description: 'Boneless skinless chicken breast. Vacuum seal and freeze in portions.' },
    { name: 'Ground Beef 80/20', brand: 'Generic', category: 'meat_seafood', store_section: 'meat', unit_type: 'lb', unit_size: 'per lb', description: 'Ground beef 80% lean. Buy bulk, portion, and freeze.' },
    { name: 'Frozen Broccoli Florets', brand: 'Generic', category: 'frozen', store_section: 'frozen', unit_type: 'lb', unit_size: '5 lb bag', description: 'IQF broccoli florets. No prep needed.' },
    { name: 'Large Eggs (Cage-Free)', brand: 'Generic', category: 'dairy_eggs', store_section: 'dairy', unit_type: 'dozen', unit_size: '2-pack / 24 ct', description: 'Cage-free large eggs. Buy 2-packs at warehouse stores.' },
    { name: 'Unsalted Butter', brand: 'Generic', category: 'dairy_eggs', store_section: 'dairy', unit_type: 'lb', unit_size: '4-pack / 4 lb', description: 'Unsalted butter. Freeze extras.' },
    { name: 'All-Purpose Flour', brand: 'Generic', category: 'pantry', store_section: 'bulk', unit_type: 'lb', unit_size: '25 lb bag', description: 'Unbleached all-purpose flour. Warehouse bulk.' },
    { name: 'Apple Cider Vinegar', brand: 'Bragg', category: 'pantry', store_section: 'pantry', unit_type: 'bottle', unit_size: '128 oz / 1 gallon', description: 'Raw unfiltered ACV with the mother. Bulk gallon jug.' },
    { name: 'Coconut Oil (Unrefined)', brand: 'Generic', category: 'pantry', store_section: 'pantry', unit_type: 'jar', unit_size: '54 oz', description: 'Cold-pressed unrefined coconut oil.' },
    { name: 'Raw Honey', brand: 'Generic', category: 'pantry', store_section: 'pantry', unit_type: 'jar', unit_size: '5 lb jar', description: 'Local raw honey. Bulk jar.' },
    { name: 'Ziploc Freezer Bags Gallon', brand: 'Ziploc', category: 'household', store_section: 'household', unit_type: 'pack', unit_size: '30-pack', description: 'Heavy-duty gallon freezer bags. Double-seal zipper.' },
    { name: 'Avery Removable Square Labels 2\"', brand: 'Avery', category: 'household', store_section: 'household', unit_type: 'pack', unit_size: '60-pack', description: 'White removable labels for dating containers.' },
  ];

  for (const p of products) {
    await db.run(
      `INSERT INTO products (id, name, brand, category, store_section, unit_type, unit_size, description, source, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom', 1)`,
      [uuidv4(), p.name, p.brand || '', p.category, p.store_section, p.unit_type || '', p.unit_size || '', p.description || '']
    );
  }
  console.log('Products catalog seeded.');
}

async function _seedPlantGuides(db) {
  const { n } = await db.get('SELECT COUNT(*) as n FROM plant_guides');
  if (n > 0) return;

  const J = JSON.stringify;
  const guides = [
    {
      common_name: 'Cherry Tomato', scientific_name: 'Solanum lycopersicum var. cerasiforme', type: 'vegetable',
      description: 'Sweet, bite-sized tomatoes that produce abundantly all season. Perfect for snacking, salads, and roasting.',
      planting_seasons: J(['spring','summer']), usda_zones: '3–11 (as annual)', days_to_germinate: 7, days_to_harvest: 55,
      space_needed_sqft: 4, spacing_between_plants_inches: 24, row_spacing_inches: 36, sunlight: 'full_sun',
      water_frequency: 'Deeply 1–2× per week; keep soil consistently moist',
      soil_type: 'Well-draining fertile loam; pH 6.0–6.8',
      companion_plants: J(['Basil','Carrots','Marigolds','Parsley','Garlic']),
      avoid_planting_with: J(['Fennel','Brassicas','Corn']),
      tips: 'Start indoors 6–8 weeks before last frost. Stake or cage plants early. Pinch suckers for larger fruit. Mulch around base to retain moisture and prevent soil splash.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Tomatoes", url: 'https://www.almanac.com/plant/tomatoes' },
        { label: 'Bonnie Plants – Cherry Tomatoes', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-tomatoes' },
        { label: 'Gardening Know How – Cherry Tomatoes', url: 'https://www.gardeningknowhow.com/edible/vegetables/tomato/cherry-tomato-plants.htm' },
      ]),
    },
    {
      common_name: 'Roma Tomato', scientific_name: 'Solanum lycopersicum', type: 'vegetable',
      description: 'Meaty paste-type tomato with low moisture and thick walls. Ideal for canning, sauces, and drying.',
      planting_seasons: J(['spring','summer']), usda_zones: '3–11 (as annual)', days_to_germinate: 7, days_to_harvest: 75,
      space_needed_sqft: 4, spacing_between_plants_inches: 24, row_spacing_inches: 36, sunlight: 'full_sun',
      water_frequency: 'Deeply 1–2× per week; avoid wetting foliage',
      soil_type: 'Well-draining loam; pH 6.0–6.8',
      companion_plants: J(['Basil','Marigolds','Carrots','Parsley']),
      avoid_planting_with: J(['Fennel','Brassicas','Potatoes']),
      tips: 'Determinate variety — all fruit ripens at once, ideal for large batch canning. Minimal staking needed. Harvest when fully red and slightly soft.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Tomatoes", url: 'https://www.almanac.com/plant/tomatoes' },
        { label: 'Bonnie Plants – Roma Tomatoes', url: 'https://bonnieplants.com/products/roma-tomato' },
        { label: 'Burpee – Roma Tomato', url: 'https://www.burpee.com/vegetables/tomatoes/tomato-roma-vf-prod000754.html' },
      ]),
    },
    {
      common_name: 'Beefsteak Tomato', scientific_name: 'Solanum lycopersicum', type: 'vegetable',
      description: 'Large classic slicing tomato with rich flavor. Heavy yields of 1–2 lb fruit. A summer staple.',
      planting_seasons: J(['spring','summer']), usda_zones: '3–11 (as annual)', days_to_germinate: 8, days_to_harvest: 80,
      space_needed_sqft: 6, spacing_between_plants_inches: 36, row_spacing_inches: 48, sunlight: 'full_sun',
      water_frequency: 'Deeply 1–2× per week; consistent watering prevents blossom end rot',
      soil_type: 'Rich well-draining loam; pH 6.2–6.8',
      companion_plants: J(['Basil','Marigolds','Borage','Garlic']),
      avoid_planting_with: J(['Fennel','Brassicas','Corn','Potatoes']),
      tips: 'Indeterminate — keep staked or caged throughout the season. Use calcium supplements if blossom end rot appears. Heavy fruit can crack if watering is inconsistent.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Tomatoes", url: 'https://www.almanac.com/plant/tomatoes' },
        { label: 'Burpee – Beefsteak Tomato', url: 'https://www.burpee.com/vegetables/tomatoes/tomato-beefsteak-prod000755.html' },
        { label: 'Gardening Know How – Growing Tomatoes', url: 'https://www.gardeningknowhow.com/edible/vegetables/tomato/tomato-plant-care.htm' },
      ]),
    },
    {
      common_name: 'Sweet Basil', scientific_name: 'Ocimum basilicum', type: 'herb',
      description: 'Classic culinary herb with fragrant sweet leaves. Essential for Italian cooking, pesto, and fresh sauces.',
      planting_seasons: J(['spring','summer']), usda_zones: '2–11 (as annual)', days_to_germinate: 5, days_to_harvest: 27,
      space_needed_sqft: 1, spacing_between_plants_inches: 12, row_spacing_inches: 18, sunlight: 'full_sun',
      water_frequency: 'Regularly; keep soil moist but not waterlogged',
      soil_type: 'Moist well-draining; pH 6.0–7.0',
      companion_plants: J(['Tomatoes','Peppers','Marigolds','Asparagus']),
      avoid_planting_with: J(['Sage','Thyme']),
      tips: 'Pinch flower heads as soon as they appear to keep leaves coming. Never let it bolt. Harvest from the top down. Bring indoors before first frost for a longer season.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Basil", url: 'https://www.almanac.com/plant/basil' },
        { label: 'Bonnie Plants – Growing Basil', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-basil' },
        { label: 'Gardening Know How – Basil', url: 'https://www.gardeningknowhow.com/edible/herbs/basil/basil-plant-care.htm' },
      ]),
    },
    {
      common_name: 'Garlic', scientific_name: 'Allium sativum', type: 'vegetable',
      description: 'A kitchen staple with strong pungent flavor. Plant in fall for summer harvest. Hardneck varieties suit cold climates; softneck for mild ones.',
      planting_seasons: J(['fall']), usda_zones: '3–9', days_to_germinate: 14, days_to_harvest: 240,
      space_needed_sqft: 0.25, spacing_between_plants_inches: 6, row_spacing_inches: 12, sunlight: 'full_sun',
      water_frequency: '1 inch per week during spring growth; stop 2 weeks before harvest',
      soil_type: 'Loose well-draining loam; pH 6.0–7.0',
      companion_plants: J(['Tomatoes','Roses','Carrots','Fruit trees']),
      avoid_planting_with: J(['Beans','Peas','Asparagus','Sage']),
      tips: 'Plant cloves pointed-side up 2 inches deep in fall. Mulch heavily. Harvest when lower leaves turn yellow-brown. Cure bulbs in a warm ventilated space for 3–4 weeks before storing.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Garlic", url: 'https://www.almanac.com/plant/garlic' },
        { label: 'Burpee – How to Grow Garlic', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-garlic.html' },
        { label: 'Gardening Know How – Garlic', url: 'https://www.gardeningknowhow.com/edible/herbs/garlic/growing-garlic-plants.htm' },
      ]),
    },
    {
      common_name: 'Rosemary', scientific_name: 'Salvia rosmarinus', type: 'herb',
      description: 'Evergreen woody herb with piney aromatic flavor. Drought-tolerant perennial in warm climates. Excellent for roasting and marinades.',
      planting_seasons: J(['spring','fall']), usda_zones: '7–11 (perennial); 2–6 (annual/container)', days_to_germinate: 14, days_to_harvest: 90,
      space_needed_sqft: 4, spacing_between_plants_inches: 24, row_spacing_inches: 36, sunlight: 'full_sun',
      water_frequency: 'Every 1–2 weeks; very drought-tolerant once established',
      soil_type: 'Sandy well-draining; pH 6.0–7.0',
      companion_plants: J(['Sage','Carrots','Cabbage','Beans']),
      avoid_planting_with: J(['Cucumbers','Pumpkins','Basil']),
      tips: 'Difficult to start from seed — buy transplants or propagate from cuttings. Never let sit in waterlogged soil. In cold climates bring containers indoors for winter.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Rosemary", url: 'https://www.almanac.com/plant/rosemary' },
        { label: 'Bonnie Plants – Rosemary', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-rosemary' },
        { label: 'Gardening Know How – Rosemary', url: 'https://www.gardeningknowhow.com/edible/herbs/rosemary/growing-rosemary-plant.htm' },
      ]),
    },
    {
      common_name: 'Mint', scientific_name: 'Mentha spp.', type: 'herb',
      description: 'Fast-spreading aromatic herb. Excellent for teas, cocktails, and savory dishes. Grow in containers to prevent spreading.',
      planting_seasons: J(['spring','fall']), usda_zones: '3–11', days_to_germinate: 10, days_to_harvest: 90,
      space_needed_sqft: 2, spacing_between_plants_inches: 18, row_spacing_inches: 24, sunlight: 'partial_shade',
      water_frequency: 'Regularly; keep soil moist',
      soil_type: 'Rich moist; pH 6.0–7.0',
      companion_plants: J(['Tomatoes','Cabbage','Peas','Brassicas']),
      avoid_planting_with: J(['Parsley','Chamomile']),
      tips: 'Grow in containers to prevent invasive spreading. Harvest before flowering for best flavor. Cut back hard after first flush to encourage fresh growth. Very winter-hardy.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Mint", url: 'https://www.almanac.com/plant/mint' },
        { label: 'Gardening Know How – Mint', url: 'https://www.gardeningknowhow.com/edible/herbs/mint/growing-mint-plants.htm' },
        { label: 'Bonnie Plants – Mint', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-mint' },
      ]),
    },
    {
      common_name: 'Jalapeño Pepper', scientific_name: 'Capsicum annuum', type: 'vegetable',
      description: 'Medium-heat chile pepper used fresh, pickled, or smoked (as chipotles). Prolific producer in hot weather.',
      planting_seasons: J(['spring','summer']), usda_zones: '4–11 (as annual)', days_to_germinate: 10, days_to_harvest: 75,
      space_needed_sqft: 2, spacing_between_plants_inches: 18, row_spacing_inches: 24, sunlight: 'full_sun',
      water_frequency: '1 inch per week; consistent moisture prevents blossom drop',
      soil_type: 'Well-draining fertile; pH 6.0–6.8',
      companion_plants: J(['Basil','Tomatoes','Carrots','Marigolds']),
      avoid_planting_with: J(['Fennel','Apricot trees','Beans']),
      tips: 'Needs warm soil (65°F+) to transplant out. Harvest green or let ripen red — flavor intensifies. Great for batch pickling and hot sauce.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Peppers", url: 'https://www.almanac.com/plant/peppers' },
        { label: 'Bonnie Plants – Hot Peppers', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-hot-peppers' },
        { label: 'Gardening Know How – Jalapeños', url: 'https://www.gardeningknowhow.com/edible/vegetables/pepper/growing-jalapeno-peppers.htm' },
      ]),
    },
    {
      common_name: 'Bell Pepper', scientific_name: 'Capsicum annuum', type: 'vegetable',
      description: 'Sweet mild pepper that turns from green to red, yellow, or orange when fully ripe. High in vitamin C.',
      planting_seasons: J(['spring','summer']), usda_zones: '4–11 (as annual)', days_to_germinate: 10, days_to_harvest: 70,
      space_needed_sqft: 2, spacing_between_plants_inches: 18, row_spacing_inches: 24, sunlight: 'full_sun',
      water_frequency: '1–1.5 inches per week; mulch to retain moisture',
      soil_type: 'Well-draining fertile loam; pH 6.0–6.8',
      companion_plants: J(['Basil','Tomatoes','Carrots','Marigolds','Spinach']),
      avoid_planting_with: J(['Fennel','Beans','Brassicas']),
      tips: 'Start indoors 8–10 weeks before last frost. Green bells are unripe — leave on longer for red/yellow. Stake as fruit gets heavy.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Peppers", url: 'https://www.almanac.com/plant/peppers' },
        { label: 'Bonnie Plants – Bell Peppers', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-sweet-bell-peppers' },
        { label: 'Burpee – Bell Pepper Guide', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-bell-peppers.html' },
      ]),
    },
    {
      common_name: 'Zucchini', scientific_name: 'Cucurbita pepo', type: 'vegetable',
      description: 'Prolific summer squash that grows quickly. Harvest small at 6–8 inches for best flavor. One plant can feed a family.',
      planting_seasons: J(['spring','summer']), usda_zones: '3–10', days_to_germinate: 7, days_to_harvest: 50,
      space_needed_sqft: 9, spacing_between_plants_inches: 36, row_spacing_inches: 48, sunlight: 'full_sun',
      water_frequency: '1 inch per week at base; avoid wetting leaves to prevent mildew',
      soil_type: 'Rich well-draining; pH 6.0–7.5',
      companion_plants: J(['Nasturtiums','Beans','Corn','Marigolds']),
      avoid_planting_with: J(['Potatoes','Fennel']),
      tips: 'Direct sow after last frost. Check daily once fruiting — harvest at 6–8 inches to keep production going. Hand-pollinate if bees are scarce.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Zucchini", url: 'https://www.almanac.com/plant/zucchini' },
        { label: 'Bonnie Plants – Zucchini', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-zucchini' },
        { label: 'Gardening Know How – Zucchini', url: 'https://www.gardeningknowhow.com/edible/vegetables/zucchini/zucchini-plant-care.htm' },
      ]),
    },
    {
      common_name: 'Cucumber', scientific_name: 'Cucumis sativus', type: 'vegetable',
      description: 'Cool crisp fruit used fresh in salads or pickled. Grows as a vine — trellising saves space and improves air circulation.',
      planting_seasons: J(['spring','summer']), usda_zones: '4–11 (as annual)', days_to_germinate: 7, days_to_harvest: 55,
      space_needed_sqft: 6, spacing_between_plants_inches: 24, row_spacing_inches: 36, sunlight: 'full_sun',
      water_frequency: '1 inch per week; consistent moisture prevents bitter fruit',
      soil_type: 'Warm well-draining fertile; pH 6.0–7.0',
      companion_plants: J(['Beans','Peas','Lettuce','Sunflowers','Radishes']),
      avoid_planting_with: J(['Sage','Rosemary','Potatoes','Melons']),
      tips: 'Sow directly after soil reaches 65°F. Trellis to prevent disease. Harvest before yellowing. Keep harvesting to encourage continued production.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Cucumbers", url: 'https://www.almanac.com/plant/cucumbers' },
        { label: 'Bonnie Plants – Cucumbers', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-cucumbers' },
        { label: 'Burpee – Cucumber Guide', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-cucumbers.html' },
      ]),
    },
    {
      common_name: 'Green Beans', scientific_name: 'Phaseolus vulgaris', type: 'vegetable',
      description: 'Easy warm-season crop. Bush varieties are compact; pole varieties need support but produce longer. Perfect for blanching and freezing.',
      planting_seasons: J(['spring','summer']), usda_zones: '3–10', days_to_germinate: 8, days_to_harvest: 55,
      space_needed_sqft: 1, spacing_between_plants_inches: 6, row_spacing_inches: 18, sunlight: 'full_sun',
      water_frequency: '1 inch per week; critical at flowering and pod set',
      soil_type: 'Well-draining average fertility; pH 6.0–7.0',
      companion_plants: J(['Carrots','Cucumbers','Squash','Strawberries','Corn']),
      avoid_planting_with: J(['Onions','Garlic','Fennel','Beets']),
      tips: 'Direct sow after last frost; beans hate transplanting. Stagger plantings every 2 weeks for continuous harvest. Harvest while pods are young and crisp. Great for batch blanching and vacuum sealing.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Green Beans", url: 'https://www.almanac.com/plant/beans' },
        { label: 'Gardening Know How – Green Beans', url: 'https://www.gardeningknowhow.com/edible/vegetables/beans/growing-string-beans.htm' },
        { label: 'Burpee – Green Bean Guide', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-beans.html' },
      ]),
    },
    {
      common_name: 'Kale', scientific_name: 'Brassica oleracea var. sabellica', type: 'vegetable',
      description: 'Cold-hardy superfood that gets sweeter after frost. Harvest outer leaves continuously for months.',
      planting_seasons: J(['spring','fall']), usda_zones: '7–11 (perennial); 2–6 (annual/biennial)', days_to_germinate: 5, days_to_harvest: 60,
      space_needed_sqft: 2, spacing_between_plants_inches: 18, row_spacing_inches: 24, sunlight: 'full_sun',
      water_frequency: '1–1.5 inches per week; consistent moisture',
      soil_type: 'Rich well-draining; pH 6.0–7.5',
      companion_plants: J(['Beets','Celery','Herbs','Potatoes','Onions']),
      avoid_planting_with: J(['Tomatoes','Strawberries','Beans','Peppers']),
      tips: 'Harvest outer leaves and leave the growing center. Flavor improves after a light frost. Great for continuous harvest all winter in mild climates.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Kale", url: 'https://www.almanac.com/plant/kale' },
        { label: 'Bonnie Plants – Kale', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-kale' },
        { label: 'Gardening Know How – Kale', url: 'https://www.gardeningknowhow.com/edible/vegetables/kale/growing-kale.htm' },
      ]),
    },
    {
      common_name: 'Spinach', scientific_name: 'Spinacia oleracea', type: 'vegetable',
      description: 'Fast-growing cool-season green packed with iron and vitamins. Bolts quickly in heat — succession sow for extended harvest.',
      planting_seasons: J(['spring','fall']), usda_zones: '3–9', days_to_germinate: 7, days_to_harvest: 45,
      space_needed_sqft: 0.5, spacing_between_plants_inches: 6, row_spacing_inches: 12, sunlight: 'partial_shade',
      water_frequency: 'Regularly; keep soil consistently moist',
      soil_type: 'Nitrogen-rich moist; pH 6.5–7.5',
      companion_plants: J(['Strawberries','Peas','Brassicas','Garlic']),
      avoid_planting_with: J(['Fennel','Potatoes']),
      tips: 'Sow every 2 weeks for continuous harvest. Bolts above 75°F. Partial shade extends the season. Harvest outer leaves or cut entire plant at soil level for regrowth.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Spinach", url: 'https://www.almanac.com/plant/spinach' },
        { label: 'Bonnie Plants – Spinach', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-spinach' },
        { label: 'Gardening Know How – Spinach', url: 'https://www.gardeningknowhow.com/edible/vegetables/spinach/growing-spinach.htm' },
      ]),
    },
    {
      common_name: 'Lettuce', scientific_name: 'Lactuca sativa', type: 'vegetable',
      description: 'Fast easy cool-weather crop. Loose-leaf varieties can be cut-and-come-again. Perfect for containers.',
      planting_seasons: J(['spring','fall']), usda_zones: '4–9', days_to_germinate: 7, days_to_harvest: 45,
      space_needed_sqft: 0.5, spacing_between_plants_inches: 8, row_spacing_inches: 12, sunlight: 'partial_shade',
      water_frequency: 'Frequently; shallow roots dry out fast',
      soil_type: 'Moist loose fertile; pH 6.0–7.0',
      companion_plants: J(['Carrots','Radishes','Strawberries','Chives','Spinach']),
      avoid_planting_with: J(['Fennel','Broccoli','Celery']),
      tips: 'Scatter seeds lightly and thin to 8 inches. Harvest outer leaves for cut-and-come-again production. Shade with cloth in summer heat to delay bolting.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Lettuce", url: 'https://www.almanac.com/plant/lettuce' },
        { label: 'Bonnie Plants – Lettuce', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-lettuce' },
        { label: 'Burpee – Lettuce Guide', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-lettuce.html' },
      ]),
    },
    {
      common_name: 'Carrots', scientific_name: 'Daucus carota subsp. sativus', type: 'vegetable',
      description: 'Root vegetable needing deep loose soil free of rocks. Many varieties for different conditions — Chantenay for heavy soils.',
      planting_seasons: J(['spring','fall']), usda_zones: '3–10', days_to_germinate: 14, days_to_harvest: 75,
      space_needed_sqft: 0.25, spacing_between_plants_inches: 3, row_spacing_inches: 12, sunlight: 'full_sun',
      water_frequency: '1 inch per week; deep watering encourages long roots',
      soil_type: 'Loose sandy loam, rock-free; pH 6.0–6.8',
      companion_plants: J(['Tomatoes','Lettuce','Onions','Rosemary','Sage']),
      avoid_planting_with: J(['Dill','Parsnips','Beets']),
      tips: 'Direct sow only — hate transplanting. Thin ruthlessly. Add sand to heavy clay soil. Flavor improves after a light frost.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Carrots", url: 'https://www.almanac.com/plant/carrots' },
        { label: 'Bonnie Plants – Carrots', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-carrots' },
        { label: 'Gardening Know How – Carrots', url: 'https://www.gardeningknowhow.com/edible/vegetables/carrots/growing-carrots.htm' },
      ]),
    },
    {
      common_name: 'Onions', scientific_name: 'Allium cepa', type: 'vegetable',
      description: 'Long-season bulbing vegetable. Easiest as sets (small bulbs). Short-day vs long-day varieties depend on your latitude.',
      planting_seasons: J(['spring','fall']), usda_zones: '3–9', days_to_germinate: 10, days_to_harvest: 100,
      space_needed_sqft: 0.25, spacing_between_plants_inches: 4, row_spacing_inches: 12, sunlight: 'full_sun',
      water_frequency: '1 inch per week; reduce as tops begin to fall over',
      soil_type: 'Loose well-draining fertile; pH 6.0–7.0',
      companion_plants: J(['Carrots','Beets','Lettuce','Tomatoes','Chamomile']),
      avoid_planting_with: J(['Beans','Peas','Asparagus','Sage']),
      tips: 'Harvest when tops fall over. Cure in warm dry ventilated space 2–3 weeks before storage. Eat short-necked onions first; long-necked store better.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Onions", url: 'https://www.almanac.com/plant/onions' },
        { label: 'Burpee – Growing Onions', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-onions.html' },
        { label: 'Gardening Know How – Onions', url: 'https://www.gardeningknowhow.com/edible/vegetables/onion/growing-onions-in-the-garden.htm' },
      ]),
    },
    {
      common_name: 'Thyme', scientific_name: 'Thymus vulgaris', type: 'herb',
      description: 'Hardy drought-tolerant perennial with earthy slightly minty flavor. Essential for French cuisine and roasting.',
      planting_seasons: J(['spring','fall']), usda_zones: '5–9', days_to_germinate: 14, days_to_harvest: 90,
      space_needed_sqft: 1, spacing_between_plants_inches: 12, row_spacing_inches: 24, sunlight: 'full_sun',
      water_frequency: 'Every 1–2 weeks; very drought-tolerant once established',
      soil_type: 'Well-draining sandy or rocky lean soil; pH 6.0–8.0',
      companion_plants: J(['Roses','Cabbage','Tomatoes','Eggplant','Potatoes']),
      avoid_planting_with: J(['Basil','Chives']),
      tips: 'Start from transplants for faster results. Cut back by one-third after flowering. Woody stems are not edible — harvest the soft leafy growth. Dry bunches for year-round use.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Thyme", url: 'https://www.almanac.com/plant/thyme' },
        { label: 'Gardening Know How – Thyme', url: 'https://www.gardeningknowhow.com/edible/herbs/thyme/growing-thyme-herb.htm' },
        { label: 'Bonnie Plants – Thyme', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-thyme' },
      ]),
    },
    {
      common_name: 'Oregano', scientific_name: 'Origanum vulgare', type: 'herb',
      description: 'Robust Mediterranean herb that intensifies when dried. Essential for pizza, pasta, and grilled meats. Hardy perennial.',
      planting_seasons: J(['spring','fall']), usda_zones: '5–10', days_to_germinate: 10, days_to_harvest: 80,
      space_needed_sqft: 2, spacing_between_plants_inches: 12, row_spacing_inches: 18, sunlight: 'full_sun',
      water_frequency: 'Every 1–2 weeks; drought-tolerant once established',
      soil_type: 'Well-draining lean; pH 6.0–8.0',
      companion_plants: J(['Peppers','Tomatoes','Asparagus','Cabbage']),
      avoid_planting_with: J(['Basil','Mint']),
      tips: 'Greek oregano has the strongest flavor. Harvest before flowering for peak oil content. Cut stems to 2 inches above soil to encourage bushy regrowth.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Oregano", url: 'https://www.almanac.com/plant/oregano' },
        { label: 'Gardening Know How – Oregano', url: 'https://www.gardeningknowhow.com/edible/herbs/oregano/growing-oregano-in-the-garden.htm' },
        { label: 'Bonnie Plants – Oregano', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-oregano' },
      ]),
    },
    {
      common_name: 'Parsley', scientific_name: 'Petroselinum crispum', type: 'herb',
      description: 'Biennial treated as annual. Flat-leaf (Italian) has better flavor; curly is decorative. Slow to germinate but productive once established.',
      planting_seasons: J(['spring','fall']), usda_zones: '5–9', days_to_germinate: 21, days_to_harvest: 80,
      space_needed_sqft: 1, spacing_between_plants_inches: 10, row_spacing_inches: 18, sunlight: 'full_sun',
      water_frequency: 'Regularly; keep moist but not waterlogged',
      soil_type: 'Moist well-draining fertile; pH 6.0–7.0',
      companion_plants: J(['Tomatoes','Roses','Carrots','Asparagus']),
      avoid_planting_with: J(['Mint','Alliums','Lettuce']),
      tips: 'Soak seeds 24 hours before planting to speed germination. Harvest outer stems first. Second-year plants bolt quickly — treat as annual for best harvest.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Parsley", url: 'https://www.almanac.com/plant/parsley' },
        { label: 'Gardening Know How – Parsley', url: 'https://www.gardeningknowhow.com/edible/herbs/parsley/how-to-grow-parsley.htm' },
        { label: 'Bonnie Plants – Parsley', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-parsley' },
      ]),
    },
    {
      common_name: 'Cilantro', scientific_name: 'Coriandrum sativum', type: 'herb',
      description: 'Fast-growing herb with bright citrusy leaves. Bolts quickly in heat. Let bolt to collect coriander seeds for cooking.',
      planting_seasons: J(['spring','fall']), usda_zones: '2–11 (as annual)', days_to_germinate: 7, days_to_harvest: 21,
      space_needed_sqft: 0.5, spacing_between_plants_inches: 6, row_spacing_inches: 12, sunlight: 'partial_shade',
      water_frequency: 'Regularly; keep soil moist',
      soil_type: 'Well-draining light; pH 6.2–6.8',
      companion_plants: J(['Spinach','Beans','Peas','Tomatoes']),
      avoid_planting_with: J(['Fennel','Lavender','Thyme']),
      tips: 'Succession plant every 2–3 weeks throughout cool seasons. Let a few plants bolt and self-seed. Collect dried seed heads for coriander spice.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Cilantro", url: 'https://www.almanac.com/plant/cilantro' },
        { label: 'Bonnie Plants – Cilantro', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-cilantro' },
        { label: 'Gardening Know How – Cilantro', url: 'https://www.gardeningknowhow.com/edible/herbs/coriander/growing-cilantro-plants.htm' },
      ]),
    },
    {
      common_name: 'Strawberries', scientific_name: 'Fragaria × ananassa', type: 'fruit',
      description: 'Perennial berry that spreads via runners. June-bearing for one big harvest; everbearing for smaller batches all season.',
      planting_seasons: J(['spring','fall']), usda_zones: '3–10', days_to_germinate: 14, days_to_harvest: 60,
      space_needed_sqft: 1, spacing_between_plants_inches: 12, row_spacing_inches: 24, sunlight: 'full_sun',
      water_frequency: '1–1.5 inches per week; critical during flowering and fruiting',
      soil_type: 'Sandy loam well-draining slightly acidic; pH 5.5–6.5',
      companion_plants: J(['Spinach','Lettuce','Beans','Borage','Thyme']),
      avoid_planting_with: J(['Fennel','Brassicas','Melons']),
      tips: 'Plant crowns with mid-point at soil level. Remove flowers the first year for stronger plants. Mulch with straw to keep fruit clean and roots cool.',
      image_url: null,
      resource_links: J([
        { label: "Old Farmer's Almanac – Strawberries", url: 'https://www.almanac.com/plant/strawberries' },
        { label: 'Bonnie Plants – Strawberries', url: 'https://bonnieplants.com/blogs/how-to-grow/growing-strawberries' },
        { label: 'Burpee – Strawberry Guide', url: 'https://www.burpee.com/gardenadviceandinformation/how-to-grow-strawberries.html' },
      ]),
    },
  ];

  for (const g of guides) {
    await db.run(`
      INSERT INTO plant_guides
        (common_name, scientific_name, type, description, planting_seasons, usda_zones,
         days_to_germinate, days_to_harvest, space_needed_sqft, spacing_between_plants_inches,
         row_spacing_inches, sunlight, water_frequency, soil_type, companion_plants,
         avoid_planting_with, tips, image_url, resource_links)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      g.common_name, g.scientific_name, g.type, g.description,
      g.planting_seasons, g.usda_zones, g.days_to_germinate, g.days_to_harvest,
      g.space_needed_sqft, g.spacing_between_plants_inches, g.row_spacing_inches,
      g.sunlight, g.water_frequency, g.soil_type, g.companion_plants,
      g.avoid_planting_with, g.tips, g.image_url, g.resource_links,
    ]);
  }
  console.log(`Seeded ${guides.length} plant guides.`);
}

module.exports = { getDb };
