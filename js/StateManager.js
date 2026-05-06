/**
 * StateManager — a simple key/value store for shared application state.
 * Using a module pattern so the state object is a singleton across the app.
 */
const StateManager = (() => {
  const _state = {
    measurements: [],   // Raw transformed measurements from AirQo
    isLoading: false,
    activeMode: 'markers', // 'markers' | 'heatmap' | 'clustering'
    error: null,
  };

  const _listeners = {};

  return {
    get(key) {
      return _state[key];
    },

    set(key, value) {
      _state[key] = value;
      // Notify any listeners for this key
      if (_listeners[key]) {
        _listeners[key].forEach(fn => fn(value));
      }
    },

    // Subscribe to state changes: StateManager.on('measurements', callback)
    on(key, callback) {
      if (!_listeners[key]) _listeners[key] = [];
      _listeners[key].push(callback);
    },
  };
})();
