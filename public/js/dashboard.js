renderNav('dashboard');

async function load() {
  try {
    const s = await api.get('/dashboard/summary');
    renderStats(s);
    renderFlights(s.recent_flights);
    renderIncidents(s.recent_incidents);
  } catch (err) {
    toast(err.message, true);
  }
}

function renderStats(s) {
  const f = s.fleet, i = s.open_incidents, h = s.flights_last_30_days;
  const stats = [
    { label: 'Active aircraft', value: `${f.active_aircraft || 0}/${f.total_aircraft || 0}`, cls: 'ok' },
    { label: 'Maintenance due', value: f.maintenance_due || 0, cls: f.maintenance_due ? 'warn' : '' },
    { label: 'Firmware alerts', value: f.firmware_alerts || 0, cls: f.firmware_alerts ? 'alert' : '' },
    { label: 'Fleet hours (total)', value: fmtHours(f.total_flight_hours) },
    { label: 'Flights, last 30d', value: h.flights || 0 },
    { label: 'Hours flown, last 30d', value: fmtHours(h.hours) },
    { label: 'Open incidents', value: i.total_open || 0, cls: i.total_open ? 'warn' : 'ok' },
    { label: 'Critical / high severity', value: (i.critical || 0) + (i.high || 0), cls: (i.critical || i.high) ? 'alert' : '' },
  ];
  document.getElementById('stat-grid').innerHTML = stats.map((s) => `
    <div class="stat">
      <p class="stat-label">${s.label}</p>
      <p class="stat-value ${s.cls || ''}">${s.value}</p>
    </div>
  `).join('');
}

function renderFlights(flights) {
  const el = document.getElementById('recent-flights');
  if (!flights.length) { el.innerHTML = `<div class="empty-state">No flights logged yet.</div>`; return; }
  el.innerHTML = `
    <table>
      <thead><tr><th>Aircraft</th><th>Pilot</th><th>Mission</th><th>Start</th><th>Duration</th><th>Distance</th></tr></thead>
      <tbody>
        ${flights.map((f) => `
          <tr>
            <td class="mono">${escapeHtml(f.tail_number || '—')}</td>
            <td>${escapeHtml(f.pilot_name || '—')}</td>
            <td>${escapeHtml(f.mission_type)}</td>
            <td>${fmtDate(f.start_time)}</td>
            <td>${fmtDuration(f.duration_minutes)}</td>
            <td>${f.distance_km != null ? f.distance_km + ' km' : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderIncidents(incidents) {
  const el = document.getElementById('recent-incidents');
  if (!incidents.length) { el.innerHTML = `<div class="empty-state">No incidents logged. Clear skies.</div>`; return; }
  el.innerHTML = `
    <table>
      <thead><tr><th>Aircraft</th><th>Category</th><th>Severity</th><th>Status</th><th>Occurred</th><th>Description</th></tr></thead>
      <tbody>
        ${incidents.map((i) => `
          <tr>
            <td class="mono">${escapeHtml(i.tail_number || '—')}</td>
            <td>${escapeHtml(i.category.replace('_', ' '))}</td>
            <td><span class="badge sev-${i.severity}">${i.severity}</span></td>
            <td><span class="badge st-${i.status}">${i.status}</span></td>
            <td>${fmtDate(i.occurred_at)}</td>
            <td class="dim">${escapeHtml((i.description || '').slice(0, 70))}${i.description && i.description.length > 70 ? '…' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

load();
