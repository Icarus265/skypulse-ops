// Uses Node's built-in SQLite module (stable in Node 22.5+) — no native
// compilation step required, which matters for field teams without a
// build toolchain available. See README > Requirements.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'skypulse.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS aircraft (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tail_number TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','grounded','retired')),
  firmware_version TEXT,
  firmware_compliant INTEGER NOT NULL DEFAULT 1,
  total_flight_hours REAL NOT NULL DEFAULT 0,
  hours_since_maintenance REAL NOT NULL DEFAULT 0,
  maintenance_interval_hours REAL NOT NULL DEFAULT 50,
  home_base TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pilots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  certification TEXT,
  role TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id INTEGER NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  pilot_id INTEGER REFERENCES pilots(id) ON DELETE SET NULL,
  mission_type TEXT NOT NULL DEFAULT 'survey' CHECK (mission_type IN ('survey','delivery','patrol','training','other')),
  launch_site TEXT,
  landing_site TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_minutes REAL,
  max_altitude_m REAL,
  distance_km REAL,
  battery_cycles INTEGER,
  route_geojson TEXT,
  source_log_file TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id INTEGER REFERENCES aircraft(id) ON DELETE SET NULL,
  flight_id INTEGER REFERENCES flights(id) ON DELETE SET NULL,
  pilot_id INTEGER REFERENCES pilots(id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  category TEXT NOT NULL DEFAULT 'anomaly' CHECK (category IN ('near_miss','equipment_failure','weather_delay','airspace_violation','lost_link','anomaly','other')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  location TEXT,
  latitude REAL,
  longitude REAL,
  description TEXT NOT NULL,
  corrective_action TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  reported_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'operational' CHECK (zone_type IN ('operational','survey_corridor','delivery_route','restricted')),
  geojson TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flights_aircraft ON flights(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_incidents_aircraft ON incidents(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
`);

module.exports = db;
