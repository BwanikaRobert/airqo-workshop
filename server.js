require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const AIRQO_GRID_ID = '67c9681471c7b0001383d7af';
const AIRQO_GRID_URL = `https://platform.airqo.net/api/v2/devices/measurements/grids/${AIRQO_GRID_ID}`;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Provide the Google Maps key to the frontend (it must be in the browser URL)
// The AirQo token stays server-side for security — never sent to the browser.
app.get('/api/config', (req, res) => {
  if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set in .env' });
  }
  res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY });
});

// Proxy AirQo grid measurements — token auth via query param
// Frontend calls: GET /api/measurements?page=1&limit=30
app.get('/api/measurements', async (req, res) => {
  if (!process.env.AIRQO_API_KEY || process.env.AIRQO_API_KEY === 'your_airqo_api_key_here') {
    return res.status(500).json({ error: 'AIRQO_API_KEY not set in .env' });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;

  try {
    const response = await axios.get(AIRQO_GRID_URL, {
      params: { token: process.env.AIRQO_API_KEY, page, limit },
      timeout: 15000,
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    console.error(`[AirQo grid API error] page ${page}:`, message);
    res.status(status).json({ error: message });
  }
});

// Proxy OpenRouteService directions — keeps the ORS key server-side
// Frontend calls: POST /api/directions { originLat, originLng, destLat, destLng, profile }
// ORS profile maps: WALKING→foot-walking, BICYCLING→cycling-regular, DRIVING→driving-car
const ORS_PROFILES = {
  WALKING:   'foot-walking',
  BICYCLING: 'cycling-regular',
  DRIVING:   'driving-car',
};

app.post('/api/directions', async (req, res) => {
  if (!process.env.ORS_API_KEY || process.env.ORS_API_KEY === 'your_ors_api_key_here') {
    return res.status(500).json({ error: 'ORS_API_KEY not set in .env — sign up free at openrouteservice.org' });
  }

  const { originLat, originLng, destLat, destLng, profile } = req.body;
  const orsProfile = ORS_PROFILES[profile] || 'foot-walking';

  try {
    const response = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`,
      {
        // ORS uses [longitude, latitude] order (GeoJSON convention)
        coordinates: [
          [originLng, originLat],
          [destLng,   destLat],
        ],
        alternative_routes: {
          target_count: 3,   // ask for up to 3 routes
          share_factor: 0.6, // routes share at most 60% of their path
          weight_factor: 1.4, // alternatives can be up to 40% longer
        },
      },
      {
        headers: { Authorization: process.env.ORS_API_KEY },
        timeout: 15000,
      }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error('[ORS Directions error]', message);
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`\nAirQo Visualizer running at http://localhost:${PORT}`);
  console.log('Make sure you have filled in your API keys in the .env file!\n');
});
