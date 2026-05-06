/**
 * StageManager — orchestrates all feature modules.
 *
 * Responsibilities:
 *   1. Owns instances of all visualization modules
 *   2. Feeds data to modules after API fetch completes
 *   3. Handles mode switching (markers / heatmap / clustering / routes)
 *   4. Updates the stats panel in the UI
 */
class StageManager {
  constructor(map) {
    this.map = map;
    this.airqoAPI = new AirQoAPI();
    this.heatmap = new HeatmapModule(map);
    this.markers = new MarkersModule(map);
    this.clustering = new ClusteringModule(map);
    this.routePlanner = null; // created after data loads (needs measurements)
  }

  /**
   * Fetch data and render all modules.
   * Called once after the map is ready.
   */
  async initialize() {
    this._setLoading(true);
    this._setError(null);

    try {
      const measurements = await this.airqoAPI.fetchAllMeasurements();

      if (measurements.length === 0) {
        this._setError('No valid measurements returned from the API.');
        return;
      }

      StateManager.set('measurements', measurements);

      // Render visualization modules (they start hidden)
      this.markers.render(measurements);
      this.heatmap.render(measurements);
      this.clustering.render(measurements);

      // Route planner gets measurements so it can score routes
      this.routePlanner = new RoutePlannerModule(this.map, measurements);
      this.routePlanner.init();

      this._updateStats(measurements);
      this.setMode('markers');

    } catch (err) {
      console.error('[StageManager] Failed to load data:', err);
      this._setError(`Failed to load AirQo data: ${err.message}`);
    } finally {
      this._setLoading(false);
    }
  }

  /**
   * Switch the active visualization layer.
   * 'routes' opens the route planner panel and hides other layers.
   * @param {'markers'|'heatmap'|'clustering'|'routes'} mode
   */
  setMode(mode) {
    StateManager.set('activeMode', mode);

    // Hide all map layers
    this.markers.setVisible(mode === 'markers');
    this.heatmap.setVisible(mode === 'heatmap');
    this.clustering.setVisible(mode === 'clustering');

    // When leaving route mode, clear drawn routes
    if (mode !== 'routes' && this.routePlanner) {
      this.routePlanner.clearRoutes();
    }

    // Toggle route panel
    const panel = document.getElementById('route-panel');
    if (panel) panel.classList.toggle('open', mode === 'routes');

    // Update toolbar button styles
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  _setLoading(isLoading) {
    StateManager.set('isLoading', isLoading);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = isLoading ? 'flex' : 'none';
  }

  _setError(message) {
    StateManager.set('error', message);
    const errorEl = document.getElementById('error-banner');
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    } else {
      errorEl.style.display = 'none';
    }
  }

  _updateStats(measurements) {
    const count = measurements.length;
    const avgPm25 = measurements.reduce((sum, m) => sum + m.pm25, 0) / count;
    const maxPm25 = Math.max(...measurements.map(m => m.pm25));

    const el = id => document.getElementById(id);
    if (el('stat-count')) el('stat-count').textContent = count;
    if (el('stat-avg')) el('stat-avg').textContent = `${avgPm25.toFixed(1)} µg/m³`;
    if (el('stat-max')) el('stat-max').textContent = `${maxPm25.toFixed(1)} µg/m³`;
  }
}
