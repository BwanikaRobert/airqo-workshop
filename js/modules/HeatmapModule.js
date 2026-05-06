/**
 * HeatmapModule — renders a Google Maps HeatmapLayer from PM2.5 values.
 *
 * How heatmap weights work:
 *   Google Maps HeatmapLayer accepts a `data` array of {location, weight} objects.
 *   Weight 0 = no contribution, 1 = max contribution.
 *   We normalize PM2.5 values: 0 µg/m³ → 0.0, 225+ µg/m³ → 1.0
 *   This maps directly to the AirQo AQI color gradient.
 *
 * Requires: google.maps.visualization library (loaded via &libraries=visualization)
 */
class HeatmapModule {
  constructor(map) {
    this.map = map;
    this.heatmapLayer = null;
  }

  render(measurements) {
    // Convert each measurement into a weighted heatmap point
    const heatmapData = measurements.map(m => ({
      location: new google.maps.LatLng(m.lat, m.lng),
      weight: m.heatmapWeight,
    }));

    this.heatmapLayer = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: null, // Start hidden
      radius: 40,         // Pixel radius of each point's influence
      opacity: 0.8,
      // Color gradient from clean air (green) to hazardous (maroon)
      // Array index 0 = weight 0, last index = weight 1
      gradient: [
        'rgba(0, 200, 83, 0)',    // transparent at zero (no data areas stay clear)
        'rgba(0, 200, 83, 1)',    // green  - Good
        'rgba(236, 170, 6, 1)',   // yellow - Moderate
        'rgba(255, 133, 31, 1)',  // orange - Unhealthy for Sensitive Groups
        'rgba(247, 69, 60, 1)',   // red    - Unhealthy
        'rgba(143, 63, 151, 1)', // purple - Very Unhealthy
        'rgba(126, 0, 35, 1)',    // maroon - Hazardous
      ],
    });

    console.log(`[HeatmapModule] Created heatmap with ${heatmapData.length} points.`);
  }

  setVisible(visible) {
    if (!this.heatmapLayer) return;
    this.heatmapLayer.setMap(visible ? this.map : null);
  }
}
