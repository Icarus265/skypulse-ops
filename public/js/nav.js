function renderNav(active) {
  const items = [
    { href: '/index.html', key: 'dashboard', label: 'Dashboard' },
    { href: '/fleet.html', key: 'fleet', label: 'Fleet' },
    { href: '/incidents.html', key: 'incidents', label: 'Incident Logbook' },
    { href: '/map.html', key: 'map', label: 'Spatial Overview' },
  ];
  const el = document.getElementById('sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="brand">
      <span class="brand-mark">SkyPulse-Ops</span>
    </div>
    <p class="brand-sub">Flight dispatch &amp; incident management</p>
    <ul class="nav">
      ${items.map((i) => `<li><a href="${i.href}" class="${i.key === active ? 'active' : ''}">${i.label}</a></li>`).join('')}
    </ul>
  `;
}
