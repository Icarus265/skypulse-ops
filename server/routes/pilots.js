const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM pilots ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, certification, role } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO pilots (name, certification, role) VALUES (?, ?, ?)')
    .run(name, certification, role);
  res.status(201).json(db.prepare('SELECT * FROM pilots WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pilots WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pilot not found' });
  const fields = ['name', 'certification', 'role', 'active'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE pilots SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM pilots WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pilots WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Pilot not found' });
  res.status(204).send();
});

module.exports = router;
