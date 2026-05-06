/**
 * ClusteringModule — groups nearby markers using MarkerClusterer.
 *
 * Why clustering?
 *   When many stations are close together (common in dense cities),
 *   individual markers overlap and become unclickable. Clustering groups
 *   them into a single marker that shows the count, and splits apart on zoom.
 *
 * Requires: @googlemaps/markerclusterer loaded via CDN in index.html
 */
class ClusteringModule {
  constructor(map) {
    this.map = map;
    this.clusterer = null;
    this.markers = [];
    this.visible = false;
  }

  render(measurements) {
    this._clearMarkers();

    // Create plain Google Maps markers (clusterer manages them)
    this.markers = measurements.map(m => {
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        title: `${m.name} — PM2.5: ${m.pm25.toFixed(1)} µg/m³`,
        icon: AirQoIcons.getIconForPm25(m.pm25, 28),
      });
      return marker;
    });

    // MarkerClusterer bundles nearby markers into one cluster circle
    // The `renderer` option lets us customize cluster appearance
    this.clusterer = new markerClusterer.MarkerClusterer({
      map: null, // Start hidden
      markers: this.markers,
      renderer: {
        render({ count, position }) {
          return new google.maps.Marker({
            position,
            label: {
              text: String(count),
              color: 'white',
              fontSize: '13px',
              fontWeight: 'bold',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#1a73e8',
              fillOpacity: 0.9,
              strokeColor: 'white',
              strokeWeight: 2,
              // Scale cluster size by number of markers inside
              scale: Math.min(18 + Math.log2(count) * 4, 40),
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
          });
        },
      },
    });

    console.log(`[ClusteringModule] Created clusterer with ${this.markers.length} markers.`);
  }

  setVisible(visible) {
    this.visible = visible;
    if (!this.clusterer) return;
    this.clusterer.setMap(visible ? this.map : null);
  }

  _clearMarkers() {
    if (this.clusterer) {
      this.clusterer.clearMarkers();
      this.clusterer.setMap(null);
      this.clusterer = null;
    }
    this.markers = [];
  }

}
