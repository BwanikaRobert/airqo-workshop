/**
 * MapManager — initializes and owns the Google Maps instance.
 * Other modules receive the map object from here rather than creating their own.
 */
class MapManager {
  constructor() {
    this.map = null;
  }

  init(elementId) {
    const mapElement = document.getElementById(elementId);
    if (!mapElement) throw new Error(`Map container #${elementId} not found`);

    // Center on Kampala, Uganda — where most AirQo sensors are deployed
    this.map = new google.maps.Map(mapElement, {
      center: { lat: 0.3476, lng: 32.5825 },
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      // Clean map style — reduces visual noise so data stands out
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    return this.map;
  }

  getMap() {
    return this.map;
  }
}
