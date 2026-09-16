// Silence Node's "SQLite is experimental" warning — the API surface we use
// (DatabaseSync, prepare/run/get/all) has been stable since Node 22.5.
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning' && /SQLite/i.test(w.message)) return;
  console.warn(w);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

require('./db'); // ensures schema is initialized on boot

const aircraftRoutes = require('./routes/aircraft');
const pilotRoutes = require('./routes/pilots');
const flightRoutes = require('./routes/flights');
const incidentRoutes = require('./routes/incidents');
const zoneRoutes = require('./routes/zones');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

app.use('/api/aircraft', aircraftRoutes);
app.use('/api/pilots', pilotRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SkyPulse-Ops server running at http://localhost:${PORT}`);
});
