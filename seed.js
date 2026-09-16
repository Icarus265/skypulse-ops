// Populates the database with representative sample data so the dashboard
// and map are not empty on first run. Safe to re-run: it clears existing
// rows in these tables first.
const db = require('./server/db');

db.exec(`
  DELETE FROM incidents; DELETE FROM flights; DELETE FROM zones;
  DELETE FROM pilots; DELETE FROM aircraft;
`);

const insertAircraft = db.prepare(`
  INSERT INTO aircraft (tail_number, model, status, firmware_version, firmware_compliant,
    total_flight_hours, hours_since_maintenance, maintenance_interval_hours, home_base, notes)
  VALUES (@tail_number, @model, @status, @firmware_version, @firmware_compliant,
    @total_flight_hours, @hours_since_maintenance, @maintenance_interval_hours, @home_base, @notes)
`);

const aircraft = [
  { tail_number: 'SP-101', model: 'WingScout Mk3', status: 'active', firmware_version: '2.4.1', firmware_compliant: 1, total_flight_hours: 182.4, hours_since_maintenance: 12.1, maintenance_interval_hours: 50, home_base: 'Lilongwe Field Station', notes: 'Primary medical-delivery airframe.' },
  { tail_number: 'SP-102', model: 'WingScout Mk3', status: 'maintenance', firmware_version: '2.3.9', firmware_compliant: 0, total_flight_hours: 240.0, hours_since_maintenance: 51.2, maintenance_interval_hours: 50, home_base: 'Lilongwe Field Station', notes: 'Firmware update pending; grounded for prop replacement.' },
  { tail_number: 'SP-201', model: 'SurveyHawk X2', status: 'active', firmware_version: '1.8.0', firmware_compliant: 1, total_flight_hours: 96.7, hours_since_maintenance: 8.4, maintenance_interval_hours: 40, home_base: 'Kasungu Conservation Camp', notes: 'Wildlife-corridor survey unit.' },
  { tail_number: 'SP-202', model: 'SurveyHawk X2', status: 'grounded', firmware_version: '1.8.0', firmware_compliant: 1, total_flight_hours: 58.3, hours_since_maintenance: 5.0, maintenance_interval_hours: 40, home_base: 'Kasungu Conservation Camp', notes: 'Grounded pending incident investigation (see logbook).' },
];
const aircraftIds = aircraft.map((a) => insertAircraft.run(a).lastInsertRowid);

const insertPilot = db.prepare(`INSERT INTO pilots (name, certification, role, active) VALUES (?, ?, ?, 1)`);
const pilotIds = [
  insertPilot.run('Amara Chirwa', 'Part 107 / RPAS-L2', 'Lead Operator').lastInsertRowid,
  insertPilot.run('Joseph Banda', 'RPAS-L1', 'Field Pilot').lastInsertRowid,
  insertPilot.run('Grace Mvula', 'RPAS-L2', 'Conservation Survey Lead').lastInsertRowid,
];

const insertFlight = db.prepare(`
  INSERT INTO flights (aircraft_id, pilot_id, mission_type, launch_site, landing_site,
    start_time, end_time, duration_minutes, max_altitude_m, distance_km, battery_cycles, route_geojson, notes)
  VALUES (@aircraft_id, @pilot_id, @mission_type, @launch_site, @landing_site,
    @start_time, @end_time, @duration_minutes, @max_altitude_m, @distance_km, @battery_cycles, @route_geojson, @notes)
`);

function iso(daysAgo, hour = 8) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const sampleRoute = (lat, lon) => JSON.stringify({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[lon, lat], [lon + 0.03, lat + 0.02], [lon + 0.06, lat - 0.01]] },
});

const flights = [
  { aircraft_id: aircraftIds[0], pilot_id: pilotIds[0], mission_type: 'delivery', launch_site: 'Lilongwe Field Station', landing_site: 'Mchinji Clinic', start_time: iso(1, 7), end_time: iso(1, 8), duration_minutes: 52, max_altitude_m: 120, distance_km: 38.2, battery_cycles: 1, route_geojson: sampleRoute(-13.9626, 33.7741), notes: 'Routine medical resupply run.' },
  { aircraft_id: aircraftIds[0], pilot_id: pilotIds[1], mission_type: 'delivery', launch_site: 'Lilongwe Field Station', landing_site: 'Dowa Health Post', start_time: iso(4, 9), end_time: iso(4, 10), duration_minutes: 47, max_altitude_m: 110, distance_km: 31.5, battery_cycles: 1, route_geojson: sampleRoute(-13.9, 33.8), notes: null },
  { aircraft_id: aircraftIds[2], pilot_id: pilotIds[2], mission_type: 'survey', launch_site: 'Kasungu Conservation Camp', landing_site: 'Kasungu Conservation Camp', start_time: iso(2, 6), end_time: iso(2, 7), duration_minutes: 68, max_altitude_m: 85, distance_km: 22.1, battery_cycles: 2, route_geojson: sampleRoute(-12.9, 33.48), notes: 'Northern boundary anti-poaching patrol.' },
  { aircraft_id: aircraftIds[3], pilot_id: pilotIds[2], mission_type: 'survey', launch_site: 'Kasungu Conservation Camp', landing_site: 'Kasungu Conservation Camp', start_time: iso(6, 6), end_time: iso(6, 7), duration_minutes: 55, max_altitude_m: 90, distance_km: 19.7, battery_cycles: 2, route_geojson: sampleRoute(-12.95, 33.5), notes: 'Lost-link event mid-mission, see incident log.' },
];
flights.forEach((f) => insertFlight.run(f));

const insertIncident = db.prepare(`
  INSERT INTO incidents (aircraft_id, pilot_id, occurred_at, category, severity, location,
    latitude, longitude, description, corrective_action, status, reported_by)
  VALUES (@aircraft_id, @pilot_id, @occurred_at, @category, @severity, @location,
    @latitude, @longitude, @description, @corrective_action, @status, @reported_by)
`);

const incidents = [
  { aircraft_id: aircraftIds[3], pilot_id: pilotIds[2], occurred_at: iso(6, 6), category: 'lost_link', severity: 'high', location: 'Kasungu North Boundary', latitude: -12.95, longitude: 33.5, description: 'Lost telemetry link for approximately 90 seconds during northern corridor survey; aircraft executed return-to-home as programmed.', corrective_action: 'Grounded pending link-budget review; scheduling antenna inspection.', status: 'investigating', reported_by: 'Grace Mvula' },
  { aircraft_id: aircraftIds[1], pilot_id: pilotIds[0], occurred_at: iso(9, 14), category: 'equipment_failure', severity: 'moderate', location: 'Lilongwe Field Station', latitude: -13.9626, longitude: 33.7741, description: 'Vibration detected in propeller 3 during pre-flight check; flight aborted before takeoff.', corrective_action: 'Propeller replaced; unit held for firmware update before return to service.', status: 'open', reported_by: 'Amara Chirwa' },
  { aircraft_id: aircraftIds[0], pilot_id: pilotIds[1], occurred_at: iso(15, 10), category: 'weather_delay', severity: 'low', location: 'Mchinji Clinic', latitude: -13.8, longitude: 32.9, description: 'Delivery mission delayed 40 minutes due to unexpected crosswind gusts exceeding operating limits.', corrective_action: 'No action needed; mission resumed once winds dropped below threshold.', status: 'resolved', reported_by: 'Joseph Banda' },
];
incidents.forEach((i) => insertIncident.run(i));

const insertZone = db.prepare(`INSERT INTO zones (name, zone_type, geojson, notes) VALUES (?, ?, ?, ?)`);
insertZone.run(
  'Kasungu Conservation Boundary',
  'operational',
  JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[33.4, -13.0], [33.6, -13.0], [33.6, -12.85], [33.4, -12.85], [33.4, -13.0]]] },
  }),
  'Authorized survey and patrol boundary for wildlife corridor monitoring.'
);
insertZone.run(
  'Lilongwe-Mchinji Delivery Corridor',
  'delivery_route',
  JSON.stringify({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[33.7741, -13.9626], [33.5, -13.9], [32.9, -13.8]] },
  }),
  'Primary medical-supply delivery corridor between field station and clinic network.'
);

console.log(`Seeded ${aircraft.length} aircraft, ${pilotIds.length} pilots, ${flights.length} flights, ${incidents.length} incidents, 2 zones.`);
