import checkGeolocationSupport from '../utils/checkGeolocationSupport';
import compassHeading from '../utils/compassHeading';

// A fork of Mapbox GL JS's GeolocateControl, simplified + compass support
export default class GeolocateControl {
  _watching = false;
  _locking = false;
  _setup = false;
  _currentLocation = null;
  _buttonClicked = false;
  constructor(options) {
    this.options = Object.assign({
      offset: [0, 0],
    }, options);
  }
  onAdd(map) {
    this._map = map;
    const container = document.createElement('div');
    container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    this._container = container;
    checkGeolocationSupport(this._setupUI);
    return this._container;
  }
  _setupUI = (supported) => {
    if (!supported) {
      console.warn('Geolocation support is not available, the GeolocateControl will not be visible.');
      return;
    }

    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-custom-geolocate';
    button.type = 'button';
    button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3a9 9 0 0 0-8-8V1h-2v2a9 9 0 0 0-8 8H1v2h2a9 9 0 0 0 8 8v2h2v-2a9 9 0 0 0 8-8h2v-2h-2zm-9 8a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/>
    </svg>`;
    button.addEventListener('click', this._clickButton, false);
    this._button = button;
    this._container.appendChild(this._button);

    const dot = document.createElement('div');
    dot.innerHTML = `<div class="user-location-dot"></div>
      <div class="user-location-compass" hidden></div>
      <div class="user-location-accuracy"></div>`;
    dot.className = 'user-location';
    this._dot = new mapboxgl.Marker(dot);
    const dotElement = this._dot.getElement();
    this._compass = dotElement.querySelector('.user-location-compass');
    // this._accuracy = dotElement.querySelector('.user-location-accuracy');

    this._map.on('movestart', (e) => {
      if (!e.geolocateSource && this._locking) {
        this._locking = false;
        this._updateButtonState(null);
      }
    });

    this._setup = true;

    if (supported === 'granted') this._clickButton(null, false);
  }
  _updateButtonState = (state) => {
    const { classList } = this._button;
    classList.remove('loading');
    classList.remove('active');
    if (state) classList.add(state);
  }
  _flyToCurrentLocation = () => {
    const map = this._map;
    const { _currentLocation: center } = this;
    const { offset: _offset } = this.options;
    const offset = typeof _offset === 'function' ? _offset() : _offset;
    const { x, y } = map.project(center);
    const { offsetWidth, offsetHeight, offsetLeft, offsetTop } = map.getContainer();
    const margin = Math.max(offsetWidth, offsetHeight);
    const withinBounds = x > offsetLeft-margin && x < offsetWidth+margin && y > offsetTop-margin && y < offsetHeight+margin;
    // console.log(center, x, y, offsetLeft, offsetTop, offsetWidth, offsetHeight);
    const eventData = {
      geolocateSource: true,
    };
    if (withinBounds) {
      if (map.getZoom() < 14) {
        map.easeTo({
          center,
          zoom: 18,
          duration: 300,
          offset,
          animate: false,
        }, eventData);
      } else {
        map.flyTo({
          center,
          zoom: 18,
          speed: 1.5,
          duration: 2000,
          offset,
        }, eventData);
      }
    } else {
      map.easeTo({
        center,
        zoom: 18,
        duration: 300,
        offset,
        animate: false,
      }, eventData);
    }
  }
  _setHeading = (e) => {
    if (!this._watching) return;
    if (!e || e.alpha === null) return;
    this._compass.hidden = false;
    const heading = e.compassHeading || e.webkitCompassHeading || compassHeading(e.alpha, e.beta, e.gamma);
    // -60deg rotateX is for *tilting* the compass "box" to look like a trapezoid
    this._compass.style.transform = `rotate(${Math.round(heading)}deg) rotateX(-60deg)`;
  }
  _clickButton = (e, locking = true) => {
    if (e) e.preventDefault();
    if (!this._setup) return;

    if (this._watching) {
      this._updateButtonState('active');
      this._flyToCurrentLocation();
      this._locking = true;
    } else {
      this._updateButtonState('loading');
      this._buttonClicked = true;
      this._locking = locking;
      let deviceorientation;

      this._watching = navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude } = position.coords;

        if (`${[latitude,longitude]}` === `${this._currentLocation}`) return; // No idea why

        // console.log({ latitude, longitude });
        this._currentLocation = [longitude, latitude];
        this._dot.setLngLat(this._currentLocation);
        if (!this._dot._addedToMap) {
          this._dot.addTo(this._map);
          this._dot._addedToMap = true;
        }

        if (this._locking) {
          this._updateButtonState('active');
          this._flyToCurrentLocation();
        } else {
          this._updateButtonState(null);
        }

        if (this._buttonClicked) {
          // Differentiate between initiated from button click or watchPosition subsequent runs
          this._buttonClicked = false;
        }
        this._watching = true;
      }, () => {
        this._locking = false;
        this._watching = false;
        this._buttonClicked = false;

        this._updateButtonState(null);
        navigator.geolocation.clearWatch(this._watching);
        if (deviceorientation) {
          window.removeEventListener(deviceorientation, this._setHeading);
        }

        // Retry again
        this._clickButton();
      }, {
        enableHighAccuracy: true,
        timeout: 60 * 1000, // 1min
        maximumAge: 1000, // 1s
      });

      if (window.DeviceOrientationEvent){
        // https://developers.google.com/web/updates/2016/03/device-orientation-changes
        // https://stackoverflow.com/a/47870694/20838
        if (location.hostname === 'localhost'){
          // Stupid bug with Chrome
          // `ondeviceorientationabsolute` is true but always return empty values
          deviceorientation = 'deviceorientation';
        } else {
          deviceorientation = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
        }
        window.addEventListener(deviceorientation, this._setHeading, false);
      }
    }
  }
}