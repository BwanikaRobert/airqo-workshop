# AirQo Pollution Visualizer

A real-time air quality visualization web app for Kampala, Uganda, built with vanilla JavaScript, Google Maps, and the AirQo API.

## Features

- **Markers view** — individual AirQo sensor stations displayed using AirQo's own air quality face icons, colored by PM2.5 level. Click any marker to see PM2.5, PM10, AQI category, and health tips.
- **Heatmap view** — a Google Maps heatmap layer showing pollution intensity across the city.
- **Clustering view** — groups nearby sensors into clusters that expand as you zoom in.
- **Safe Route Planner** — select a start and end location from AirQo sensor sites, choose a travel mode (walking, cycling, or driving), and get up to 3 route alternatives ranked by average PM2.5 exposure. Routes are drawn as colored polylines; hover over station markers along each route to see air quality stats.

## Tech Stack

- **Frontend** — vanilla HTML, CSS, JavaScript (no framework)
- **Backend** — Node.js + Express (security proxy to keep API keys off the browser)
- **Maps** — Google Maps JavaScript API (visualization + geometry libraries)
- **Air quality data** — AirQo Grid Measurements API
- **Routing** — OpenRouteService Directions API
- **Hosting** — Netlify (static site + serverless functions)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Google Maps API key](https://console.cloud.google.com/) with these APIs enabled:
  - Maps JavaScript API
  - Visualization API (for heatmap)
- An [AirQo API token](https://platform.airqo.net/)
- An [OpenRouteService API key](https://openrouteservice.org/dev/#/signup) (free, no credit card required)

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/airqo-visualizer.git
cd airqo-visualizer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
AIRQO_API_KEY=your_airqo_token_here
ORS_API_KEY=your_openrouteservice_key_here
PORT=4000
```

### 4. Start the development server

```bash
npm run dev
```

Then open [http://localhost:4000](http://localhost:4000) in your browser.

`npm run dev` uses nodemon and hot-reloads on file changes. Use `npm start` for a plain server without hot reload.

## Project Structure

```
airqo-visualizer/
├── index.html                      # Main page — map, toolbar, route panel
├── server.js                       # Express server (API proxy for local dev)
├── netlify.toml                    # Netlify build + redirect config
├── css/
│   └── style.css                   # All styles
├── js/
│   ├── app.js                      # Boot: fetches config, injects Maps script
│   ├── StateManager.js             # Simple key/value store with listeners
│   ├── MapManager.js               # Initializes the Google Map
│   ├── StageManager.js             # Orchestrates all modules and mode switching
│   ├── airqo-icons.js              # AirQo face SVG icons as Google Maps markers
│   └── modules/
│       ├── AirQoAPI.js             # Fetches and normalizes AirQo measurements
│       ├── MarkersModule.js        # Individual station markers with info windows
│       ├── HeatmapModule.js        # Google Maps heatmap layer
│       ├── ClusteringModule.js     # MarkerClusterer integration
│       └── RoutePlannerModule.js   # Route fetching, scoring, and rendering
└── netlify/
    └── functions/
        ├── config.js               # Serves Google Maps key to the browser
        ├── measurements.js         # Proxies AirQo API requests
        └── directions.js           # Proxies OpenRouteService requests
```

## How It Works

The Express server (locally) and Netlify Functions (in production) act as a security proxy — the AirQo token and ORS key never reach the browser. Only the Google Maps key is sent to the client (required by the Maps API; restrict it by domain in Google Cloud Console).

Route scoring samples each route polyline every 300 m, finds the nearest AirQo sensor within 1.5 km of each sample point, and averages the PM2.5 readings to produce an exposure score. Routes are ranked safest first.

## Deploying to Netlify

1. Push the repo to GitHub.
2. Connect it to [Netlify](https://app.netlify.com) — it will auto-detect `netlify.toml`.
3. Add environment variables in **Site configuration → Environment variables**:
   - `GOOGLE_MAPS_API_KEY`
   - `AIRQO_API_KEY`
   - `ORS_API_KEY`
4. Leave the **Build command** field blank — no build step is needed.
5. Trigger a deploy.

## AQI Color Scale

| Color | Category | PM2.5 (µg/m³) |
|-------|----------|---------------|
| 🟢 Green | Good | 0 – 9.1 |
| 🟡 Yellow | Moderate | 9.1 – 35.5 |
| 🟠 Orange | Unhealthy for Sensitive Groups | 35.5 – 55.5 |
| 🔴 Red | Unhealthy | 55.5 – 125.5 |
| 🟣 Purple | Very Unhealthy | 125.5 – 225.5 |
| ⚫ Maroon | Hazardous | 225.5+ |
