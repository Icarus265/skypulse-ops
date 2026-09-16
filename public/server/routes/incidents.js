const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/incidents?status=&severity=&aircraft_id=
router.get('/', (req, res) => {
  const { status, severity, aircraft_id } = req.query;
  let sql = `
    SELECT incidents.*, aircraft.tail_number, pilots.name AS pilot_name
    FROM incidents
    LEFT JOIN aircraft ON aircraft.id = incidents.aircraft_id
    LEFT JOIN pilots ON pilots.id = incidents.pilot_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND incidents.status = ?'; params.push(status); }
  if (severity) { sql += ' AND incidents.severity = ?'; params.push(severity); }
  if (aircraft_id) { sql += ' AND incidents.aircraft_id = ?'; params.push(aircraft_id); }
  sql += ' ORDER BY incidents.occurred_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Incident not found' });
  res.json(row);
});

// POST /api/incidents
router.post('/', (req, res) => {
  const {
    aircraft_id, flight_id, pilot_id, occurred_at, category, severity,
    location, latitude, longitude, description, corrective_action, reported_by
  } = req.body;

  if (!description) return res.status(400).json({ error: 'description is required' });

  const info = db.prepare(`
    INSERT INTO incidents (aircraft_id, flight_id, pilot_id, occurred_at, category, severity,
      location, latitude, longitude, description, corrective_action, reported_by)
    VALUES (?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, 'anomaly'), COALESCE(?, 'low'),
      ?, ?, ?, ?, ?, ?)
  `).run(aircraft_id, flight_id, pilot_id, occurred_at, category, severity,
    location, latitude, longitude, description, corrective_action, reported_by);

  res.status(201).json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(info.lastInsertRowid));
});

// PATCH /api/incidents/:id - update status / add corrective action / re-grade severity
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Incident not found' });

  const fields = ['category', 'severity', 'location', 'description', 'corrective_action', 'status'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE incidents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Incident not found' });
  res.status(204).send();
});

module.exports = router;
