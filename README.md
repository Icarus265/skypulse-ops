# SkyPulse-Ops

Open-source flight dispatch and incident management system for humanitarian and conservation UAV operations.

SkyPulse-Ops centralizes fleet status, flight logs, safety incidents, and spatial operational data in a single lightweight web app — built for field teams who don't need (or can't afford) an enterprise drone-ops SaaS platform.

![status](https://img.shields.io/badge/status-MVP-yellow) ![license](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Mission & Fleet Dashboard** — fleet-wide utilization, maintenance alerts, firmware compliance, and recent activity at a glance.
- **Flight Log Parser** — import CSV telemetry logs to auto-populate flight duration, distance, altitude, and route.
- **Safety & Incident Logbook** — structured incident records with severity grading, status tracking, and corrective actions.
- **Spatial Overview** — Leaflet.js map rendering operational zones, survey corridors, delivery routes, and recent flight tracks as GeoJSON.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | HTML5, vanilla JavaScript, [Leaflet.js](https://leafletjs.com/) |
| Backend | Node.js + Express (REST API) |
| Database | SQLite via Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) module |
| License | MIT |

SQLite is the default for zero-config local/small-deployment use, and `node:sqlite` means there's no native module to compile — important for field teams without a C++ build toolchain on hand. See [Scaling to PostgreSQL](#scaling-to-postgresql) below if you outgrow it.

## Getting started

**Requirements:** Node.js 22.5+ (for the built-in `node:sqlite` module)

```bash
git clone https://github.com/<your-username>/skypulse-ops.git
cd skypulse-ops
npm install
cp .env.example .env
npm run seed     # optional — loads sample aircraft, flights, incidents, zones
npm start
```

The app is served at `http://localhost:3000`. The SQLite database is created automatically at `data/skypulse.db` on first run.

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Design tokens

The UI uses a three-color brand palette, defined as CSS custom properties at the top of `public/css/styles.css`:

| Token | Hex | Role |
|---|---|---|
| `--navy` | `#192853` | Sidebar, headings, primary text |
| `--yellow` | `#FFE14F` | Primary actions, active nav state, accent |
| `--bg` | `#ECF4F7` | Page background |

Status/severity colors (green/amber/red/blue) are layered on top for functional meaning (active/warning/critical/info) and aren't part of the brand palette.

## Project structure

```
skypulse-ops/
├── server/
│   ├── index.js          # Express app entry point
│   ├── db.js              # SQLite connection + schema
│   ├── routes/            # REST endpoints (aircraft, flights, incidents, zones, dashboard)
│   └── utils/
│       └── logParser.js   # CSV telemetry log parser
├── public/                 # Static frontend (dashboard, fleet, incidents, map)
│   ├── css/
│   └── js/
├── data/                   # SQLite database file + sample telemetry CSV (gitignored db)
├── seed.js                 # Sample data loader
└── package.json
```

## Flight Log Parser: supported format

The MVP importer accepts a single, well-defined CSV shape rather than every proprietary logger format:

```csv
timestamp,latitude,longitude,altitude_m
2026-09-10T07:00:00Z,-13.9626,33.7741,0
2026-09-10T07:01:00Z,-13.9580,33.7790,45
...
```

- `timestamp` — ISO 8601 or epoch milliseconds
- `latitude`, `longitude` — decimal degrees
- `altitude_m` — meters (optional but recommended)

This matches the output of common tools such as `mavlogdump.py --format csv` (ArduPilot/PX4 `.bin`/`.ulg` logs) or a converted DJI `.srt` file. A sample file is included at `data/sample-flight-log.csv` — try importing it from the Fleet page.

**Extending to other formats:** add a new parser function in `server/utils/logParser.js` and branch on file extension or a header signature. Native support for MAVLink binary logs or DJI's proprietary format is a good next contribution.

## API overview

All endpoints are under `/api`. Full request/response shapes are in the route files under `server/routes/`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard/summary` | Fleet-wide rollup for the dashboard |
| GET/POST | `/api/aircraft` | List / register aircraft |
| PATCH | `/api/aircraft/:id` | Update status, firmware, maintenance fields |
| POST | `/api/aircraft/:id/maintenance` | Log maintenance, reset the interval clock |
| GET/POST | `/api/flights` | List / manually log a flight |
| POST | `/api/flights/import` | Import a CSV telemetry log (`multipart/form-data`, fields: `logfile`, `aircraft_id`) |
| GET/POST | `/api/incidents` | List (filter by `status`, `severity`, `aircraft_id`) / log an incident |
| PATCH | `/api/incidents/:id` | Update status, severity, corrective action |
| GET/POST | `/api/zones` | List / create operational zones (GeoJSON) |
| GET/POST | `/api/pilots` | List / register pilots |

## Scaling to PostgreSQL

The schema in `server/db.js` uses standard SQL with no SQLite-specific features beyond `datetime('now')` defaults. To move to PostgreSQL for multi-user or production deployments:

1. Swap `node:sqlite` for `pg` (or an ORM such as Knex/Prisma).
2. Translate the `CREATE TABLE` statements in `server/db.js` (mainly: `AUTOINCREMENT` → `SERIAL`/`IDENTITY`, `datetime('now')` → `now()`).
3. Update the route files' prepared-statement calls to the async `pg` query API.

This is intentionally left as a scaling path rather than built into the MVP, to keep local setup at zero config.

## Roadmap ideas

- Role-based auth (pilot vs. supervisor vs. read-only observer)
- Battery lifecycle tracking as its own entity (cycle counts, degradation alerts)
- Native MAVLink/DJI log ingestion
- Exportable compliance reports (PDF/CSV)
- Multi-tenant support for organizations running several field sites

## Contributing

Issues and pull requests are welcome. This project is intended as a transparent, adaptable reference implementation — fork it for your own fleet's needs.

## License

[MIT](LICENSE)
