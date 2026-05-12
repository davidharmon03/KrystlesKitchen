const express  = require('express')
const archiver = require('archiver')
const { getDb } = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// GET /api/export/my-data  — streams a ZIP of user's data
router.get('/my-data', authMiddleware, async (req, res) => {
  try {
    const db     = await getDb()
    const userId = req.user.id

    const [recipes, receipts, inventory, swaps, plants, harvests] = await Promise.all([
      db.all('SELECT * FROM recipes WHERE author_id = ?', userId),
      db.all('SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC', userId),
      db.all('SELECT * FROM inventory_items WHERE added_by = ? ORDER BY created_at DESC', userId),
      db.all('SELECT * FROM swap_entrees WHERE user_id = ? ORDER BY created_at DESC', userId),
      db.all('SELECT * FROM garden_plants WHERE added_by = ? ORDER BY created_at DESC', userId),
      db.all('SELECT * FROM harvest_logs WHERE added_by = ? ORDER BY created_at DESC', userId),
    ])

    const filename = `krystles-hub-export-${new Date().toISOString().split('T')[0]}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', err => { console.error('[export] archiver error:', err); res.end() })
    archive.pipe(res)

    // recipes.json
    archive.append(JSON.stringify(recipes, null, 2), { name: 'recipes.json' })

    // spending.csv
    const spendingRows = [
      'date,amount,description',
      ...receipts.map(r =>
        [r.created_at, r.amount, `"${(r.description || '').replace(/"/g, '""')}"`].join(',')
      ),
    ]
    archive.append(spendingRows.join('\n'), { name: 'spending.csv' })

    // inventory.csv
    const inventoryRows = [
      'name,quantity,category,storage_type,notes,use_by_date,created_at',
      ...inventory.map(i =>
        [
          `"${(i.name || '').replace(/"/g, '""')}"`,
          `"${(i.quantity || '').replace(/"/g, '""')}"`,
          i.category || '',
          i.storage_type || '',
          `"${(i.notes || '').replace(/"/g, '""')}"`,
          i.use_by_date || '',
          i.created_at || '',
        ].join(',')
      ),
    ]
    archive.append(inventoryRows.join('\n'), { name: 'inventory.csv' })

    // swaps.csv
    const swapsRows = [
      'entree_name,status,notes,created_at',
      ...swaps.map(s =>
        [
          `"${(s.entree_name || '').replace(/"/g, '""')}"`,
          s.status || '',
          `"${(s.notes || '').replace(/"/g, '""')}"`,
          s.created_at || '',
        ].join(',')
      ),
    ]
    archive.append(swapsRows.join('\n'), { name: 'swaps.csv' })

    // garden.csv
    const gardenRows = [
      'plant_name,date_planted,expected_harvest,status,notes,created_at',
      ...plants.map(p =>
        [
          `"${(p.plant_name || '').replace(/"/g, '""')}"`,
          p.date_planted || '',
          p.expected_harvest || '',
          p.status || '',
          `"${(p.notes || '').replace(/"/g, '""')}"`,
          p.created_at || '',
        ].join(',')
      ),
    ]
    archive.append(gardenRows.join('\n'), { name: 'garden.csv' })

    // harvests.csv
    const harvestRows = [
      'plant_name,harvest_date,yield_amount,notes,created_at',
      ...harvests.map(h =>
        [
          `"${(h.plant_name || '').replace(/"/g, '""')}"`,
          h.harvest_date || '',
          `"${(h.yield_amount || '').replace(/"/g, '""')}"`,
          `"${(h.notes || '').replace(/"/g, '""')}"`,
          h.created_at || '',
        ].join(',')
      ),
    ]
    archive.append(harvestRows.join('\n'), { name: 'harvests.csv' })

    await archive.finalize()
  } catch (err) {
    console.error('[export] error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Export failed' })
  }
})

module.exports = router
