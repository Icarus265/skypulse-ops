const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/aircraft - list fleet, with maintenance-alert flag
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT *,
      (hours_since_maintenance >= maintenance_interval_hours) AS maintenance_due,
      (firmware_compliant = 0) AS firmware_alert
    FROM aircraft
    ORDER BY tail_number
  `).all();
  res.json(rows);
});

// GET /api/aircraft/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM aircraft WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Aircraft not found' });
  res.json(row);
});

// POST /api/aircraft - register a new airframe
router.post('/', (req, res) => {
  const { tail_number, model, status, firmware_version, maintenance_interval_hours, home_base, notes } = req.body;
  if (!tail_number || !model) {
    return res.status(400).json({ error: 'tail_number and model are required' });
  }
  try {
    const stmt = db.prepare(`
      INSERT INTO aircraft (tail_number, model, status, firmware_version, maintenance_interval_hours, home_base, notes)
      VALUES (?, ?, COALESCE(?, 'active'), ?, COALESCE(?, 50), ?, ?)
    `);
    const info = stmt.run(tail_number, model, status, firmware_version, maintenance_interval_hours, home_base, notes);
    res.status(201).json(db.prepare('SELECT * FROM aircraft WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({ error: `Tail number ${tail_number} already exists` });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/aircraft/:id - update status, firmware, maintenance
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM aircraft WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Aircraft not found' });

  const fields = ['model', 'status', 'firmware_version', 'firmware_compliant', 'hours_since_maintenance',
    'maintenance_interval_hours', 'home_base', 'notes'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE aircraft SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM aircraft WHERE id = ?').get(req.params.id));
});

// POST /api/aircraft/:id/maintenance - log a maintenance event, reset the interval clock
router.post('/:id/maintenance', (req, res) => {
  const existing = db.prepare('SELECT * FROM aircraft WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Aircraft not found' });

  db.prepare(`UPDATE aircraft SET hours_since_maintenance = 0, status = 'active' WHERE id = ?`).run(req.params.id);
  res.json(db.prepare('SELECT * FROM aircraft WHERE id = ?').get(req.params.id));
});

// DELETE /api/aircraft/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM aircraft WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Aircraft not found' });
  res.status(204).send();
});

module.exports = router;
