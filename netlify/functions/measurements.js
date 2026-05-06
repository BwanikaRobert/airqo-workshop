const axios = require('axios');

const AIRQO_GRID_URL =
  'https://platform.airqo.net/api/v2/devices/measurements/grids/67c9681471c7b0001383d7af';

exports.handler = async (event) => {
  if (!process.env.AIRQO_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'AIRQO_API_KEY not configured in Netlify environment variables' }),
    };
  }

  const params = event.queryStringParameters || {};
  const page  = parseInt(params.page)  || 1;
  const limit = parseInt(params.limit) || 30;

  try {
    const response = await axios.get(AIRQO_GRID_URL, {
      params: { token: process.env.AIRQO_API_KEY, page, limit },
      timeout: 10000,
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.data),
    };
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    return {
      statusCode: status,
      body: JSON.stringify({ error: message }),
    };
  }
};
