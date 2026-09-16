/**
 * MVP flight log parser.
 *
 * Supported format: generic CSV telemetry export with a header row containing
 * (at minimum) `timestamp,latitude,longitude,altitude_m`. This matches the
 * column layout produced by common tools such as `mavlogdump.py --format csv`
 * (ArduPilot/PX4 .bin/.ulg logs) or a DJI SRT-to-CSV conversion.
 *
 * This is intentionally a single, well-documented format rather than an
 * attempt to natively support every proprietary log type. Convert other
 * formats to this CSV shape before import — see README > Flight Log Parser.
 *
 * Expected columns (header names are case-insensitive, order-independent):
 *   timestamp   - ISO 8601 or epoch millis
 *   latitude    - decimal degrees
 *   longitude   - decimal degrees
 *   altitude_m  - meters above ground/home (optional but recommended)
 */

function parseLogFile(text, filename = 'log.csv') {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('File must contain a header row and at least one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = {
    timestamp: header.indexOf('timestamp'),
    lat: header.indexOf('latitude'),
    lon: header.indexOf('longitude'),
    alt: header.indexOf('altitude_m'),
  };
  if (idx.timestamp === -1 || idx.lat === -1 || idx.lon === -1) {
    throw new Error('CSV must include timestamp, latitude, longitude columns');
  }

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const tsRaw = cols[idx.timestamp]?.trim();
    const lat = parseFloat(cols[idx.lat]);
    const lon = parseFloat(cols[idx.lon]);
    const alt = idx.alt !== -1 ? parseFloat(cols[idx.alt]) : null;
    if (!tsRaw || Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const ts = /^\d+$/.test(tsRaw) ? new Date(Number(tsRaw)) : new Date(tsRaw);
    if (Number.isNaN(ts.getTime())) continue;

    points.push({ time: ts, lat, lon, alt: Number.isNaN(alt) ? null : alt });
  }

  if (points.length < 2) {
    throw new Error('Fewer than 2 valid telemetry points parsed');
  }

  points.sort((a, b) => a.time - b.time);

  const startTime = points[0].time.toISOString();
  const endTime = points[points.length - 1].time.toISOString();
  const durationMinutes = (points[points.length - 1].time - points[0].time) / 60000;

  const altitudes = points.map((p) => p.alt).filter((a) => a !== null);
  const maxAltitudeM = altitudes.length ? Math.max(...altitudes) : null;

  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }

  const routeGeojson = {
    type: 'Feature',
    properties: { source: filename },
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lon, p.lat]),
    },
  };

  return {
    startTime,
    endTime,
    durationMinutes: Math.round(durationMinutes * 100) / 100,
    maxAltitudeM,
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    pointCount: points.length,
    routeGeojson,
    summary: {
      points: points.length,
      duration_minutes: Math.round(durationMinutes * 100) / 100,
      distance_km: Math.round(distanceKm * 1000) / 1000,
      max_altitude_m: maxAltitudeM,
    },
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { parseLogFile };
