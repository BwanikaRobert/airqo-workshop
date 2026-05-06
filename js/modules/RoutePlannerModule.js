/**
 * RoutePlannerModule — finds routes between two AirQo sensor sites and ranks them by air quality.
 *
 * Routing engine: OpenRouteService (free, no credit card required)
 *   - Server proxies requests to keep the ORS key off the browser
 *   - ORS returns GeoJSON FeatureCollection; each Feature is one route
 *   - Coordinates are [longitude, latitude] — opposite of Google's convention
 *
 * Scoring:
 *   - Sample each route's polyline every 300 m
 *   - Find the nearest AirQo station within 1.5 km of each sample point
 *   - Average the PM2.5 readings → exposure score for that route
 *   - Rank routes lowest (safest) → highest (most polluted)
 *
 * Requires: google.maps.geometry library (for distance maths)
 */
class RoutePlannerModule {
  constructor(map, measurements) {
    this.map = map;
    this.measurements = measurements;
    this.polylines = [];
    this.routeMarkers = [];          // hover markers placed along each route
    this.hoverInfoWindow = null;     // single shared info window (only one open at a time)
    this.rankedRoutes = [];
    this.selectedTravelMode = 'WALKING';
  }

  init() {
    this._populateDropdowns();

    document.querySelectorAll('.travel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.travel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTravelMode = btn.dataset.mode;
      });
    });

    document.getElementById('find-routes-btn').addEventListener('click', () => {
      this._onFindRoutes();
    });

    window._routePlanner = this;
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  clearRoutes() {
    this.polylines.forEach(p => p.setMap(null));
    this.polylines = [];
    this.routeMarkers.forEach(m => m.setMap(null));
    this.routeMarkers = [];
    if (this.hoverInfoWindow) { this.hoverInfoWindow.close(); }
    this.rankedRoutes = [];
    const el = document.getElementById('route-results');
    if (el) el.innerHTML = '';
  }

  highlightRoute(rank) {
    this.polylines.forEach((line, i) => {
      line.setOptions({
        strokeOpacity: i === rank ? 0.92 : 0.25,
        strokeWeight:  i === rank ? 7    : 3,
        zIndex:        i === rank ? 10   : 1,
      });
    });
    document.querySelectorAll('.route-card').forEach((card, i) => {
      card.classList.toggle('route-card--selected', i === rank);
    });
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _populateDropdowns() {
    const sorted = this.measurements
      .map((m, i) => ({ ...m, idx: i }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const blank = '<option value="" disabled selected>Select a location…</option>';
    const options = sorted.map(m => {
      const area = m.district || m.city || 'Kampala';
      return `<option value="${m.idx}">${m.name} — ${area}</option>`;
    }).join('');

    const html = blank + options;
    document.getElementById('origin-select').innerHTML = html;
    document.getElementById('destination-select').innerHTML = html;
  }

  async _onFindRoutes() {
    const originVal = document.getElementById('origin-select').value;
    const destVal   = document.getElementById('destination-select').value;

    if (originVal === '' || destVal === '') {
      this._renderError('Please select both a starting point and a destination.');
      return;
    }
    if (originVal === destVal) {
      this._renderError('Starting point and destination must be different locations.');
      return;
    }

    const origin = this.measurements[parseInt(originVal)];
    const dest   = this.measurements[parseInt(destVal)];

    this._setLoading(true);
    this.clearRoutes();

    try {
      const geojson = await this._fetchDirections(origin, dest, this.selectedTravelMode);

      if (!geojson.features || geojson.features.length === 0) {
        this._renderError('No routes found between these locations.');
        return;
      }

      // Score each ORS feature (route), sort safest first
      this.rankedRoutes = geojson.features
        .map((feature, i) => ({ ...this._scoreRoute(feature), originalIndex: i }))
        .sort((a, b) => (a.avgPm25 ?? Infinity) - (b.avgPm25 ?? Infinity));

      this._drawPolylines();
      this._renderResults();
    } catch (err) {
      console.error('[RoutePlanner]', err);
      this._renderError(err.message);
    } finally {
      this._setLoading(false);
    }
  }

  /** POST to our server proxy, which forwards to ORS with the API key. */
  async _fetchDirections(origin, dest, travelMode) {
    const res = await fetch('/api/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originLat:  origin.lat,
        originLng:  origin.lng,
        destLat:    dest.lat,
        destLng:    dest.lng,
        profile:    travelMode,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Score one ORS GeoJSON Feature by average PM2.5 exposure along its path.
   * ORS coordinates are [lng, lat] — we flip them for Google Maps.
   */
  _scoreRoute(feature) {
    // Convert [lng, lat] → google.maps.LatLng
    const path = feature.geometry.coordinates.map(
      ([lng, lat]) => new google.maps.LatLng(lat, lng)
    );

    const samples = this._samplePath(path, 300);
    let total = 0, hits = 0;
    const seenSiteIds = new Set();
    const hitMeasurements = []; // unique stations that contributed to the score

    for (const point of samples) {
      const m = this._findNearest(point, 1500);
      if (m) {
        total += m.pm25;
        hits++;
        // Only add each station once so we don't place duplicate markers
        if (!seenSiteIds.has(m.siteId)) {
          seenSiteIds.add(m.siteId);
          hitMeasurements.push(m);
        }
      }
    }

    const avgPm25 = hits > 0 ? total / hits : null;
    const props   = feature.properties.summary;

    return {
      path,
      hitMeasurements,
      avgPm25,
      aqiCategory: this._pm25ToCategory(avgPm25),
      aqiColor:    this._pm25ToColor(avgPm25),
      distance:    this._formatDistance(props.distance),
      duration:    this._formatDuration(props.duration),
      coverage:    samples.length > 0 ? Math.round((hits / samples.length) * 100) : 0,
    };
  }

  /** Sample points along a polyline at every `intervalMeters` metres. */
  _samplePath(path, intervalMeters) {
    if (!path.length) return [];
    const samples = [path[0]];
    let carry = 0;

    for (let i = 1; i < path.length; i++) {
      carry += google.maps.geometry.spherical.computeDistanceBetween(path[i - 1], path[i]);
      if (carry >= intervalMeters) {
        samples.push(path[i]);
        carry = 0;
      }
    }
    samples.push(path[path.length - 1]);
    return samples;
  }

  /** Return the closest measurement within maxRadius metres, or null. */
  _findNearest(latLng, maxRadius) {
    let nearest = null, minDist = maxRadius;
    for (const m of this.measurements) {
      const dist = google.maps.geometry.spherical.computeDistanceBetween(
        latLng, new google.maps.LatLng(m.lat, m.lng)
      );
      if (dist < minDist) { minDist = dist; nearest = m; }
    }
    return nearest;
  }

  _drawPolylines() {
    const rankColors = ['#00C853', '#FF851F', '#F7453C'];

    // One shared InfoWindow so only one tooltip is open at a time
    this.hoverInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

    this.rankedRoutes.forEach((r, rank) => {
      const color  = rankColors[Math.min(rank, 2)];
      const isBest = rank === 0;

      const line = new google.maps.Polyline({
        path:          r.path,
        map:           this.map,
        strokeColor:   color,
        strokeOpacity: isBest ? 0.92 : 0.55,
        strokeWeight:  isBest ? 7    : 4,
        zIndex:        isBest ? 10   : 5 - rank,
      });

      line.addListener('click', () => this.highlightRoute(rank));
      this.polylines.push(line);

      // Place hover markers at every AirQo station that influenced this route's score
      this._placeRouteMarkers(r);
    });

    const bounds = new google.maps.LatLngBounds();
    this.rankedRoutes.forEach(r => r.path.forEach(p => bounds.extend(p)));
    this.map.fitBounds(bounds, { padding: 80 });
  }

  /** Place a hover marker for each unique station along a route. */
  _placeRouteMarkers(route) {
    route.hitMeasurements.forEach(m => {
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map:      this.map,
        icon:     AirQoIcons.getIconForPm25(m.pm25, 26),
        title:    m.name,
        zIndex:   20,
      });

      marker.addListener('mouseover', () => {
        this.hoverInfoWindow.setContent(this._buildHoverTooltip(m));
        this.hoverInfoWindow.open(this.map, marker);
      });

      marker.addListener('mouseout', () => {
        this.hoverInfoWindow.close();
      });

      this.routeMarkers.push(marker);
    });
  }

  /** HTML content shown inside the InfoWindow on marker hover. */
  _buildHoverTooltip(m) {
    const timeStr = m.time
      ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

    const pm10Row = m.pm10 !== null
      ? `<div class="ht-row"><span>PM10</span><span>${m.pm10.toFixed(1)} µg/m³</span></div>`
      : '';

    return `
      <div class="hover-tooltip">
        <div class="ht-name">${m.name}</div>
        <span class="ht-badge" style="background:${m.aqiColor}">${m.aqiCategory}</span>
        <div class="ht-stats">
          <div class="ht-row">
            <span>PM2.5</span>
            <strong style="color:${m.aqiColor}">${m.pm25.toFixed(1)} µg/m³</strong>
          </div>
          ${pm10Row}
          <div class="ht-row ht-time">
            <span>Last reading</span><span>${timeStr}</span>
          </div>
        </div>
      </div>`;
  }

  _renderResults() {
    const labels     = ['Safest Route', 'Alternative 1', 'Alternative 2'];
    const routeCards = this.rankedRoutes.map((r, rank) => `
      <div class="route-card ${rank === 0 ? 'route-card--best' : ''}"
           onclick="window._routePlanner.highlightRoute(${rank})">
        <div class="route-card-header">
          <div class="route-color-bar" style="background:${r.aqiColor}"></div>
          <div class="route-header-text">
            <span class="route-rank-label">${labels[rank] || 'Alternative'}</span>
          </div>
        </div>
        <div class="route-metrics">
          <div class="route-metric">
            <span class="metric-label">Distance</span>
            <span class="metric-value">${r.distance}</span>
          </div>
          <div class="route-metric">
            <span class="metric-label">Est. Time</span>
            <span class="metric-value">${r.duration}</span>
          </div>
          <div class="route-metric">
            <span class="metric-label">Avg PM2.5</span>
            <span class="metric-value" style="color:${r.aqiColor}">
              ${r.avgPm25 !== null ? r.avgPm25.toFixed(1) + ' µg/m³' : 'No data'}
            </span>
          </div>
        </div>
        <div class="route-aqi-badge" style="color:${r.aqiColor}; border-color:${r.aqiColor}">
          ${r.aqiCategory}
          <span class="route-coverage">${r.coverage}% sensor coverage</span>
        </div>
      </div>
    `).join('');

    document.getElementById('route-results').innerHTML =
      `<p class="routes-found-label">${this.rankedRoutes.length} route(s) ranked by air quality</p>`
      + routeCards;
  }

  _setLoading(loading) {
    const btn = document.getElementById('find-routes-btn');
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = loading ? 'Searching…' : 'Find Safe Routes';
  }

  _renderError(msg) {
    document.getElementById('route-results').innerHTML =
      `<p class="route-error">${msg}</p>`;
  }

  _formatDistance(meters) {
    return meters >= 1000
      ? `${(meters / 1000).toFixed(1)} km`
      : `${Math.round(meters)} m`;
  }

  _formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    return mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}m`
      : `${mins} min`;
  }

  _pm25ToCategory(pm25) {
    if (pm25 === null)   return 'No sensor data on this route';
    if (pm25 <= 9.1)    return 'Good';
    if (pm25 <= 35.49)  return 'Moderate';
    if (pm25 <= 55.49)  return 'Unhealthy for Sensitive Groups';
    if (pm25 <= 125.49) return 'Unhealthy';
    if (pm25 <= 225.49) return 'Very Unhealthy';
    return 'Hazardous';
  }

  _pm25ToColor(pm25) {
    if (pm25 === null)   return '#888888';
    if (pm25 <= 9.1)    return '#00C853';
    if (pm25 <= 35.49)  return '#ECAA06';
    if (pm25 <= 55.49)  return '#FF851F';
    if (pm25 <= 125.49) return '#F7453C';
    if (pm25 <= 225.49) return '#8F3F97';
    return '#7E0023';
  }
}
