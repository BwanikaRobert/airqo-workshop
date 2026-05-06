const AIRQO_GRID_URL =
  'https://platform.airqo.net/api/v2/devices/measurements/grids/67c9681471c7b0001383d7af';

exports.handler = async (event) => {
  const key = process.env.AIRQO_API_KEY;

  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'AIRQO_API_KEY not set in Netlify environment variables' }),
    };
  }

  const params = event.queryStringParameters || {};
  const page  = parseInt(params.page)  || 1;
  const limit = parseInt(params.limit) || 30;

  const url = `${AIRQO_GRID_URL}?token=${encodeURIComponent(key)}&page=${page}&limit=${limit}`;

  console.log('[measurements] fetching page', page, '| key prefix:', key.slice(0, 6));

  try {
    const res  = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `AirQo returned ${res.status}`, detail: text.slice(0, 300) }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
