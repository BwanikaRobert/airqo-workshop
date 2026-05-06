/**
 * app.js — entry point.
 *
 * Boot sequence:
 *   1. Fetch config from server (Google Maps key)
 *   2. Dynamically inject the Maps <script> tag
 *   3. Maps fires `initMap` callback when ready
 *   4. MapManager initializes the map
 *   5. StageManager fetches AirQo data and renders everything
 */

async function boot() {
  try {
    // Step 1: Get the Google Maps key from our server
    const res = await fetch('/api/config');
    if (!res.ok) {
      const err = await res.json();
      showFatalError(err.error || 'Could not load config from server');
      return;
    }
    const { googleMapsApiKey } = await res.json();

    // Step 2: Inject the Google Maps script dynamically
    // We do this here (not in HTML) because the key comes from the server
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=visualization,geometry&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => showFatalError('Failed to load Google Maps. Check your API key.');
    document.head.appendChild(script);

  } catch (err) {
    showFatalError(`Cannot reach server: ${err.message}. Is "npm start" running?`);
  }
}

// Step 3-5: Called by the Maps script when the API is ready
async function initMap() {
  const mapManager = new MapManager();
  const map = mapManager.init('map');

  const stageManager = new StageManager(map);

  // Wire up the mode-switching buttons in the toolbar
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => stageManager.setMode(btn.dataset.mode));
  });

  // Close button on the route panel returns to markers view
  document.getElementById('close-route-panel').addEventListener('click', () => {
    stageManager.setMode('markers');
  });

  await stageManager.initialize();
}

function showFatalError(message) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div class="fatal-error">
        <h2>Setup Error</h2>
        <p>${message}</p>
        <p>Check the README for setup instructions.</p>
      </div>`;
  }
  console.error('[App]', message);
}

// Start the boot sequence when the DOM is ready
document.addEventListener('DOMContentLoaded', boot);
