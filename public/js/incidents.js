renderNav('incidents');

const STATUS_CYCLE = { open: 'investigating', investigating: 'resolved', resolved: 'closed', closed: 'open' };

async function load() {
  try {
    const status = document.getElementById('filter-status').value;
    const severity = document.getElementById('filter-severity').value;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    const incidents = await api.get(`/incidents?${params.toString()}`);
    renderTable(incidents);
  } catch (err) {
    toast(err.message, true);
  }
}

function renderTable(incidents) {
  const el = document.getElementById('incident-table');
  if (!incidents.length) {
    el.innerHTML = `<div class="empty-state">No incidents match these filters.</div>`;
    return;
  }
  el.innerHTML = `
    <table>
      <thead>
        <tr><th>Occurred</th><th>Aircraft</th><th>Category</th><th>Severity</th><th>Status</th><th>Description</th><th></th></tr>
      </thead>
      <tbody>
        ${incidents.map((i) => `
          <tr>
            <td>${fmtDate(i.occurred_at)}</td>
            <td class="mono">${escapeHtml(i.tail_number || '—')}</td>
            <td>${escapeHtml(i.category.replace('_', ' '))}</td>
            <td><span class="badge sev-${i.severity}">${i.severity}</span></td>
            <td><span class="badge st-${i.status}">${i.status}</span></td>
            <td class="dim" style="max-width:280px;">${escapeHtml(i.description)}</td>
            <td><button onclick="advanceStatus(${i.id}, '${i.status}')">Advance status</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function advanceStatus(id, currentStatus) {
  const next = STATUS_CYCLE[currentStatus];
  try {
    await api.patch(`/incidents/${id}`, { status: next });
    toast(`Marked as ${next}.`);
    load();
  } catch (err) {
    toast(err.message, true);
  }
}

function openIncidentModal() { document.getElementById('incident-modal').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function populateAircraftSelect() {
  try {
    const aircraft = await api.get('/aircraft');
    const sel = document.getElementById('incident-aircraft-select');
    aircraft.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.tail_number} — ${a.model}`;
      sel.appendChild(opt);
    });
  } catch (err) { /* non-fatal */ }
}

document.getElementById('incident-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  if (!body.aircraft_id) delete body.aircraft_id;
  try {
    await api.post('/incidents', body);
    toast('Incident logged.');
    closeModal('incident-modal');
    e.target.reset();
    load();
  } catch (err) {
    toast(err.message, true);
  }
});

populateAircraftSelect();
load();
