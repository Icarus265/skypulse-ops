renderNav('map');

const ZONE_COLORS = {
  operational: '#192853',
  survey_corridor: '#F0CF2E',
  delivery_route: '#3E6FB0',
  restricted: '#C1432E',
};

const map = L.map('map', { attributionControl: true }).setView([-13.5, 33.6], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

async function loadZones() {
  try {
    const zones = await api.get('/zones');
    const group = L.featureGroup();
    zones.forEach((z) => {
      const color = ZONE_COLORS[z.zone_type] || '#4FB6A8';
      const layer = L.geoJSON(z.geojson, {
        style: { color, weight: 2, fillOpacity: 0.08 },
      }).bindPopup(`<strong>${escapeHtml(z.name)}</strong><br>${escapeHtml(z.zone_type.replace('_', ' '))}${z.notes ? '<br>' + escapeHtml(z.notes) : ''}`);
      layer.addTo(group);
    });
    group.addTo(map);
    if (zones.length) map.fitBounds(group.getBounds(), { padding: [30, 30] });
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadFlightTracks() {
  try {
    const flights = await api.get('/flights?limit=15');
    flights.filter((f) => f.route_geojson).forEach((f) => {
      const geo = JSON.parse(f.route_geojson);
      L.geoJSON(geo, {
        style: { color: '#64719A', weight: 1.5, dashArray: '4 4', opacity: 0.8 },
      }).bindPopup(`<strong>${escapeHtml(f.tail_number || 'Flight')}</strong><br>${escapeHtml(f.mission_type)} · ${fmtDate(f.start_time)}`)
        .addTo(map);
    });
  } catch (err) {
    toast(err.message, true);
  }
}

loadZones();
loadFlightTracks();
