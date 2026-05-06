/**
 * MarkersModule — places individual colored markers on the map.
 *
 * Each marker is colored by AQI category (green → yellow → orange → red → purple).
 * Clicking a marker opens an InfoWindow with details about that station.
 */
class MarkersModule {
  constructor(map) {
    this.map = map;
    this.markers = [];
    this.activeInfoWindow = null; // Track open info window so we can close it
    this.visible = false;
  }

  /**
   * Create all markers from the normalized measurements array.
   * Call this once after data is loaded.
   */
  render(measurements) {
    this._clearMarkers();

    measurements.forEach(m => {
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: null, // Don't show yet — setVisible() controls this
        title: m.name,
        icon: AirQoIcons.getIconForPm25(m.pm25, 36),
        // Store our data on the marker for the click handler
        measurement: m,
      });

      marker.addListener('click', () => this._openInfoWindow(marker, m));
      this.markers.push(marker);
    });

    console.log(`[MarkersModule] Created ${this.markers.length} markers.`);
  }

  setVisible(visible) {
    this.visible = visible;
    const targetMap = visible ? this.map : null;
    this.markers.forEach(m => m.setMap(targetMap));
    if (!visible && this.activeInfoWindow) {
      this.activeInfoWindow.close();
    }
  }

  _clearMarkers() {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
  }

  /**
   * Build and open an InfoWindow with station details.
   * We close the previous one first so only one is open at a time.
   */
  _openInfoWindow(marker, m) {
    if (this.activeInfoWindow) this.activeInfoWindow.close();

    const timeStr = m.time
      ? new Date(m.time).toLocaleString()
      : 'Unknown';

    const tipsHtml = m.healthTips.length > 0
      ? `<p class="info-tip">${m.healthTips[0].description}</p>`
      : '';

    const content = `
      <div class="info-window">
        <div class="info-header" style="background:${m.aqiColor}">
          <span class="info-aqi-index">${m.aqiIndex ?? '—'}</span>
          <span class="info-category">${m.aqiCategory}</span>
        </div>
        <div class="info-body">
          <h3>${m.name}</h3>
          <p class="info-address">${m.address}</p>
          <div class="info-stats">
            <div class="info-stat">
              <span class="stat-label">PM2.5</span>
              <span class="stat-value">${m.pm25.toFixed(1)} µg/m³</span>
            </div>
            ${m.pm10 !== null ? `
            <div class="info-stat">
              <span class="stat-label">PM10</span>
              <span class="stat-value">${m.pm10.toFixed(1)} µg/m³</span>
            </div>` : ''}
          </div>
          <p class="info-meta">Category: ${m.siteCategory}</p>
          <p class="info-meta">Last reading: ${timeStr}</p>
          ${tipsHtml}
        </div>
      </div>`;

    this.activeInfoWindow = new google.maps.InfoWindow({ content, maxWidth: 300 });
    this.activeInfoWindow.open(this.map, marker);
  }
}
