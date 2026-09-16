const express = require('express');
const multer = require('multer');
const db = require('../db');
const { parseLogFile } = require('../utils/logParser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function applyFlightToAircraft(aircraftId, durationMinutes) {
  const hours = durationMinutes / 60;
  db.prepare(`
    UPDATE aircraft
    SET total_flight_hours = total_flight_hours + ?,
        hours_since_maintenance = hours_since_maintenance + ?,
        status = CASE WHEN hours_since_maintenance + ? >= maintenance_interval_hours THEN 'maintenance' ELSE status END
    WHERE id = ?
  `).run(hours, hours, hours, aircraftId);
}

// GET /api/flights?aircraft_id=&limit=
router.get('/', (req, res) => {
  const { aircraft_id, limit } = req.query;
  let sql = `
    SELECT flights.*, aircraft.tail_number, pilots.name AS pilot_name
    FROM flights
    LEFT JOIN aircraft ON aircraft.id = flights.aircraft_id
    LEFT JOIN pilots ON pilots.id = flights.pilot_id
  `;
  const params = [];
  if (aircraft_id) { sql += ' WHERE flights.aircraft_id = ?'; params.push(aircraft_id); }
  sql += ' ORDER BY flights.start_time DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
  res.json(db.prepare(sql).all(...params));
});

// POST /api/flights - manual flight log entry
router.post('/', (req, res) => {
  const {
    aircraft_id, pilot_id, mission_type, launch_site, landing_site,
    start_time, end_time, max_altitude_m, distance_km, battery_cycles,
    route_geojson, notes
  } = req.body;

  if (!aircraft_id || !start_time) {
    return res.status(400).json({ error: 'aircraft_id and start_time are required' });
  }
  const aircraft = db.prepare('SELECT * FROM aircraft WHERE id = ?').get(aircraft_id);
  if (!aircraft) return res.status(404).json({ error: 'Aircraft not found' });

  const durationMinutes = end_time
    ? (new Date(end_time) - new Date(start_time)) / 60000
    : null;

  const info = db.prepare(`
    INSERT INTO flights (aircraft_id, pilot_id, mission_type, launch_site, landing_site,
      start_time, end_time, duration_minutes, max_altitude_m, distance_km, battery_cycles, route_geojson, notes)
    VALUES (?, ?, COALESCE(?, 'survey'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(aircraft_id, pilot_id, mission_type, launch_site, landing_site,
    start_time, end_time, durationMinutes, max_altitude_m, distance_km, battery_cycles,
    route_geojson ? JSON.stringify(route_geojson) : null, notes);

  if (durationMinutes) applyFlightToAircraft(aircraft_id, durationMinutes);

  res.status(201).json(db.prepare('SELECT * FROM flights WHERE id = ?').get(info.lastInsertRowid));
});

// POST /api/flights/import - ingest a flight log file (CSV telemetry export)
// Requires aircraft_id as a form field alongside the file.
router.post('/import', upload.single('logfile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'logfile is required (multipart/form-data)' });
  const { aircraft_id } = req.body;
  if (!aircraft_id) return res.status(400).json({ error: 'aircraft_id is required' });

  const aircraft = db.prepare('SELECT * FROM aircraft WHERE id = ?').get(aircraft_id);
  if (!aircraft) return res.status(404).json({ error: 'Aircraft not found' });

  let parsed;
  try {
    parsed = parseLogFile(req.file.buffer.toString('utf-8'), req.file.originalname);
  } catch (err) {
    return res.status(422).json({ error: `Could not parse log file: ${err.message}` });
  }

  const info = db.prepare(`
    INSERT INTO flights (aircraft_id, mission_type, start_time, end_time, duration_minutes,
      max_altitude_m, distance_km, source_log_file, route_geojson, notes)
    VALUES (?, 'survey', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(aircraft_id, parsed.startTime, parsed.endTime, parsed.durationMinutes,
    parsed.maxAltitudeM, parsed.distanceKm, req.file.originalname,
    parsed.routeGeojson ? JSON.stringify(parsed.routeGeojson) : null,
    `Auto-imported from ${req.file.originalname} (${parsed.pointCount} telemetry points)`);

  applyFlightToAircraft(aircraft_id, parsed.durationMinutes);

  res.status(201).json({
    flight: db.prepare('SELECT * FROM flights WHERE id = ?').get(info.lastInsertRowid),
    parsed_summary: parsed.summary,
  });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM flights WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Flight not found' });
  res.status(204).send();
});

module.exports = router;
