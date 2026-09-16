const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM zones ORDER BY name').all();
  res.json(rows.map((r) => ({ ...r, geojson: JSON.parse(r.geojson) })));
});

router.post('/', (req, res) => {
  const { name, zone_type, geojson, notes } = req.body;
  if (!name || !geojson) return res.status(400).json({ error: 'name and geojson are required' });
  const info = db.prepare(`
    INSERT INTO zones (name, zone_type, geojson, notes) VALUES (?, COALESCE(?, 'operational'), ?, ?)
  `).run(name, zone_type, JSON.stringify(geojson), notes);
  const row = db.prepare('SELECT * FROM zones WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...row, geojson: JSON.parse(row.geojson) });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM zones WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Zone not found' });
  res.status(204).send();
});

module.exports = router;
