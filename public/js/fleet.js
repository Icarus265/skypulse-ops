renderNav('fleet');

let aircraftCache = [];

async function load() {
  try {
    aircraftCache = await api.get('/aircraft');
    renderTable();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderTable() {
  const el = document.getElementById('fleet-table');
  if (!aircraftCache.length) {
    el.innerHTML = `<div class="empty-state">No aircraft registered yet. Add one to get started.</div>`;
    return;
  }
  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Tail #</th><th>Model</th><th>Status</th><th>Firmware</th>
          <th>Total hrs</th><th>Since maint.</th><th>Home base</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${aircraftCache.map((a) => `
          <tr>
            <td class="mono">${escapeHtml(a.tail_number)}</td>
            <td>${escapeHtml(a.model)}</td>
            <td><span class="badge status-${a.status}">${a.status}</span></td>
            <td class="mono">
              ${escapeHtml(a.firmware_version || '—')}
              ${a.firmware_alert ? '<span class="badge sev-high" style="margin-left:6px;">out of date</span>' : ''}
            </td>
            <td class="mono">${fmtHours(a.total_flight_hours)}</td>
            <td class="mono ${a.maintenance_due ? 'dim' : ''}" style="${a.maintenance_due ? 'color:var(--amber)' : ''}">
              ${fmtHours(a.hours_since_maintenance)} / ${fmtHours(a.maintenance_interval_hours)}
            </td>
            <td class="dim">${escapeHtml(a.home_base || '—')}</td>
            <td style="white-space:nowrap;">
              <button onclick="logFlight(${a.id})">Log flight</button>
              ${a.maintenance_due || a.status === 'maintenance' ? `<button onclick="clearMaintenance(${a.id})">Clear maint.</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ---------- Register aircraft ----------
function openAircraftModal() { document.getElementById('aircraft-modal').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.getElementById('aircraft-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  body.maintenance_interval_hours = Number(body.maintenance_interval_hours) || 50;
  try {
    await api.post('/aircraft', body);
    toast(`${body.tail_number} registered.`);
    closeModal('aircraft-modal');
    e.target.reset();
    load();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- Clear maintenance ----------
async function clearMaintenance(id) {
  try {
    await api.post(`/aircraft/${id}/maintenance`, {});
    toast('Maintenance cleared — clock reset.');
    load();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- Quick flight log ----------
async function logFlight(aircraftId) {
  const durationStr = prompt('Flight duration in minutes?');
  if (!durationStr) return;
  const duration = Number(durationStr);
  if (!duration || duration <= 0) return toast('Enter a valid duration in minutes.', true);

  const end = new Date();
  const start = new Date(end.getTime() - duration * 60000);
  try {
    await api.post('/flights', {
      aircraft_id: aircraftId,
      mission_type: 'survey',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
    toast('Flight logged.');
    load();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- Import log file ----------
function openImportModal() {
  const sel = document.getElementById('import-aircraft-select');
  sel.innerHTML = aircraftCache.map((a) => `<option value="${a.id}">${escapeHtml(a.tail_number)} — ${escapeHtml(a.model)}</option>`).join('');
  document.getElementById('import-modal').classList.add('open');
}

document.getElementById('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const result = await api.upload('/flights/import', fd);
    const s = result.parsed_summary;
    toast(`Imported: ${s.points} points, ${s.duration_minutes} min, ${s.distance_km} km.`);
    closeModal('import-modal');
    e.target.reset();
    load();
  } catch (err) {
    toast(err.message, true);
  }
});

load();
