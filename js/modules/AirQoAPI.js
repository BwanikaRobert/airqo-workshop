/**
 * AirQoAPI — fetches and normalizes measurements from our server proxy.
 *
 * Why proxy through our server?
 *   The AirQo token stays on the server — it's never sent to the browser.
 *   This also avoids CORS issues when calling the AirQo API directly.
 *
 * Data flow:
 *   Browser → GET /api/measurements?page=N → server.js → AirQo grid API → browser
 *
 * The grid endpoint is paginated (30 per page), so we loop through all pages.
 */
class AirQoAPI {
  constructor() {
    this.PROXY_URL = '/api/measurements';
    this.PAGE_LIMIT = 30;
  }

  async _fetchPage(page) {
    const url = `${this.PROXY_URL}?page=${page}&limit=${this.PAGE_LIMIT}`;
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Fetch all pages and merge into one normalized array.
   * @returns {Promise<Array>} Normalized measurements ready for the map
   */
  async fetchAllMeasurements() {
    console.log('[AirQoAPI] Starting paginated fetch...');
    let allMeasurements = [];
    let page = 1;
    let totalPages = 1;

    do {
      console.log(`[AirQoAPI] Fetching page ${page} of ${totalPages}...`);
      const data = await this._fetchPage(page);

      if (!data.measurements || !Array.isArray(data.measurements)) {
        console.warn('[AirQoAPI] Unexpected response shape:', data);
        break;
      }

      totalPages = data.meta?.pages || 1;
      allMeasurements = allMeasurements.concat(data.measurements);
      page++;
    } while (page <= totalPages);

    console.log(`[AirQoAPI] Fetched ${allMeasurements.length} total measurements across ${totalPages} page(s).`);

    const normalized = allMeasurements
      .filter(this._isValid)
      .map(this._normalize);

    console.log(`[AirQoAPI] ${normalized.length} valid measurements after filtering.`);
    return normalized;
  }

  /**
   * Filter out measurements that are missing coordinates or PM2.5 values.
   * Bad data would cause errors or misleading visualizations.
   */
  _isValid(m) {
    const lat = m.siteDetails?.approximate_latitude;
    const lng = m.siteDetails?.approximate_longitude;
    const pm25 = m.pm2_5?.value;
    return (
      lat != null && lng != null &&
      !isNaN(lat) && !isNaN(lng) &&
      pm25 != null && !isNaN(pm25) && pm25 >= 0
    );
  }

  /**
   * Transform a raw API measurement into a clean, flat object.
   * This separates our app's data model from the API shape —
   * if the API changes, we only update this function.
   */
  _normalize(m) {
    const s = m.siteDetails;
    return {
      // Identity
      deviceId: m.device,
      siteId: m.site_id,

      // Location
      lat: s.approximate_latitude,
      lng: s.approximate_longitude,
      name: s.name || s.formatted_name || 'Unknown Site',
      address: s.formatted_name || '',
      city: s.city || '',
      district: s.district || '',

      // Air quality readings
      pm25: m.pm2_5.value,
      pm10: m.pm10?.value ?? null,

      // AQI metadata (computed server-side by AirQo)
      aqiIndex: m.aqi_index,
      aqiCategory: m.aqi_category || 'Unknown',
      aqiColor: `#${m.aqi_color || 'AAAAAA'}`,  // API sends hex without #
      aqiColorName: m.aqi_color_name || 'Grey',

      // Health info
      healthTips: m.health_tips || [],
      siteCategory: s.site_category?.category || 'Unknown',

      // Timestamps
      time: m.time,
      isOnline: s.rawOnlineStatus ?? false,

      // Heatmap weight: normalize PM2.5 to 0–1 range.
      // 225 µg/m³ is the AirQo "hazardous" threshold — anything above gets max weight.
      heatmapWeight: Math.min(m.pm2_5.value / 225, 1),
    };
  }
}
