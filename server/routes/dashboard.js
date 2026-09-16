const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/dashboard/summary - fleet-wide rollup for the landing dashboard
router.get('/summary', (req, res) => {
  const fleet = db.prepare(`
    SELECT
      COUNT(*) AS total_aircraft,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_aircraft,
      SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS in_maintenance,
      SUM(CASE WHEN status = 'grounded' THEN 1 ELSE 0 END) AS grounded,
      SUM(CASE WHEN hours_since_maintenance >= maintenance_interval_hours THEN 1 ELSE 0 END) AS maintenance_due,
      SUM(CASE WHEN firmware_compliant = 0 THEN 1 ELSE 0 END) AS firmware_alerts,
      ROUND(SUM(total_flight_hours), 1) AS total_flight_hours
    FROM aircraft
  `).get();

  const flights30d = db.prepare(`
    SELECT COUNT(*) AS flights, ROUND(SUM(duration_minutes) / 60.0, 1) AS hours
    FROM flights
    WHERE start_time >= datetime('now', '-30 days')
  `).get();

  const incidentStats = db.prepare(`
    SELECT
      COUNT(*) AS total_open,
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical,
      SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high
    FROM incidents WHERE status IN ('open','investigating')
  `).get();

  const recentIncidents = db.prepare(`
    SELECT incidents.*, aircraft.tail_number
    FROM incidents LEFT JOIN aircraft ON aircraft.id = incidents.aircraft_id
    ORDER BY occurred_at DESC LIMIT 5
  `).all();

  const recentFlights = db.prepare(`
    SELECT flights.*, aircraft.tail_number, pilots.name AS pilot_name
    FROM flights
    LEFT JOIN aircraft ON aircraft.id = flights.aircraft_id
    LEFT JOIN pilots ON pilots.id = flights.pilot_id
    ORDER BY start_time DESC LIMIT 5
  `).all();

  res.json({
    fleet,
    flights_last_30_days: flights30d,
    open_incidents: incidentStats,
    recent_incidents: recentIncidents,
    recent_flights: recentFlights,
  });
});

module.exports = router;
