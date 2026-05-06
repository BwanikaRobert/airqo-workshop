const axios = require('axios');

const ORS_PROFILES = {
  WALKING:   'foot-walking',
  BICYCLING: 'cycling-regular',
  DRIVING:   'driving-car',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.ORS_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ORS_API_KEY not configured in Netlify environment variables' }),
    };
  }

  const { originLat, originLng, destLat, destLng, profile } = JSON.parse(event.body || '{}');
  const orsProfile = ORS_PROFILES[profile] || 'foot-walking';

  try {
    const response = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`,
      {
        coordinates: [
          [originLng, originLat],
          [destLng,   destLat],
        ],
        alternative_routes: {
          target_count:  3,
          share_factor:  0.6,
          weight_factor: 1.4,
        },
      },
      {
        headers: { Authorization: process.env.ORS_API_KEY },
        timeout: 10000,
      }
    );
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.data),
    };
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    return {
      statusCode: status,
      body: JSON.stringify({ error: message }),
    };
  }
};
