exports.handler = async () => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured in Netlify environment variables' }),
    };
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }),
  };
};
