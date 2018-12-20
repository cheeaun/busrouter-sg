import { h, render, Component } from 'preact';
import { toGeoJSON } from '@mapbox/polyline';
import Fuse from 'fuse.js';
import intersect from 'just-intersect';
import cheapRuler from 'cheap-ruler';
import { encode, decode } from '../utils/specialID';
import { timeDisplay, sortServices } from '../utils/bus';
import fetchCache from '../utils/fetchCache';
import { MAPBOX_ACCESS_TOKEN, MAPTILER_KEY } from './config';
import Ad from './ad';

import stopImagePath from './images/stop.png';
import stopEndImagePath from './images/stop-end.png';
import openNewWindowImagePath from './images/open-new-window.svg';
import passingRoutesImagePath from './images/passing-routes.svg';
import iconSVGPath from '../icons/icon.svg';

import routesJSONPath from '../data/3/routes.polyline.json';
import stopsJSONPath from '../data/3/stops.final.json';
import servicesJSONPath from '../data/3/services.final.json';

const APP_NAME = 'BusRouter SG';
const APP_LONG_NAME = 'Singapore Bus Routes Explorer';
const $map = document.getElementById('map');
const STORE = {};
const BREAKPOINT = () => window.innerWidth > 640;
const supportsHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
const supportsPromise = 'Promise' in window;
const ruler = cheapRuler(1.3);

const $logo = document.getElementById('logo');
const $about = document.getElementById('about');
const $closeAbout = document.getElementById('close-about');

const redirectToOldSite = () => {
  const redirect = confirm('Looks like your browser is a little old. Redirecting you to the older version of BusRouter SG.');
  if (redirect) location.href = 'https://v1.busrouter.sg/';
};

if (!supportsPromise) {
  redirectToOldSite();
}

$closeAbout.onclick = $logo.onclick = () => {
  $about.hidden = !$about.hidden;
  try {
    localStorage.setItem('busroutersg.about', 'true');
  } catch (e) { }
}
try {
  const intro = localStorage.getItem('busroutersg.about');
  if (intro !== 'true') $about.hidden = false;
} catch (e) { }

const getRoute = () => {
  const path = location.hash.replace(/^#/, '') || '/';
  if (path === '/') return { page: 'home' };
  let [_, page, value, subpage] = path.match(/(service|stop|between)s?\/([^\/]+)\/?([^\/]+)?/) || [];
  return { page, value, path, subpage };
};

class BusServicesArrival extends Component {
  state = {
    isLoading: false,
    servicesArrivals: {},
  }
  componentDidMount() {
    this._fetchServices();
    const { map } = this.props;
    if (!map.getSource('buses')){
      map.addSource('buses', {
        type: 'geojson',
        tolerance: 10,
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      map.addLayer({
        id: 'buses',
        type: 'circle',
        source: 'buses',
        minzoom: 14,
        paint: {
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            15, 2,
            16, 4
          ],
          'circle-color': '#00454d',
          'circle-opacity': .8,
        },
      });
      map.addLayer({
        id: 'buses-label',
        type: 'symbol',
        source: 'buses',
        minzoom: 14,
        layout: {
          'text-field': ['get', 'number'],
          'text-size': 10,
          'text-anchor': 'left',
          'text-offset': [.6, .1],
          'text-font': ['Roboto Medium', 'Noto Sans Regular'],
        },
        paint: {
          'text-color': '#00454d',
          'text-halo-color': 'rgba(255,255,255,.75)',
          'text-halo-width': 1,
          'text-opacity': .8,
        },
      });
    }
  }
  componentWillUnmount() {
    this._removeBuses();
  }
  _removeBuses = () => {
    const { map } = this.props;
    map.getSource('buses').setData({
      type: 'FeatureCollection',
      features: [],
    });
  }
  componentDidUpdate(prevProps) {
    if (prevProps.id !== this.props.id) {
      // Hacky fix since Preact doesn't fire componentWillUnmount
      this._removeBuses();
      clearTimeout(this._arrivalsTimeout);
      this.setState({
        servicesArrivals: {},
      });
      this._fetchServices();
    }
  }
  _arrivalsTimeout = null;
  _fetchServices = () => {
    const { id, map } = this.props;
    if (!id) return;
    this.setState({ isLoading: true });
    fetch(`https://arrivelah.busrouter.sg/?id=${id}`).then(res => res.json()).then(results => {
      const servicesArrivals = {};
      const { services } = results;
      services.forEach(service => servicesArrivals[service.no] = service.next.duration_ms);
      this.setState({
        isLoading: false,
        servicesArrivals,
      });

      setTimeout(() => {
        const servicesWithCoords = services.filter(s => s.no && s.next.lat > 0);
        const pointMargin = 100;
        const servicesWithFixedCoords = servicesWithCoords.map(s => {
          const coords = [s.next.lng, s.next.lat];
          const point = map.project(coords);
          let shortestDistance = Infinity;
          let nearestCoords;
          if (point.x && point.y) {
            const features = map.queryRenderedFeatures([
              [point.x - pointMargin, point.y - pointMargin],
              [point.x + pointMargin, point.y + pointMargin]
            ])
            features.forEach(f => {
              if (f.sourceLayer === 'transportation' && f.layer.type === 'line' && f.properties.class != 'path' && !/(pedestrian|sidewalk|steps)/.test(f.layer.id)) {
                const nearestPoint = ruler.pointOnLine(f.geometry.coordinates, coords);
                if (nearestPoint.t) {
                  const distance = ruler.distance(coords, nearestPoint.point);
                  if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestCoords = nearestPoint.point;
                  }
                }
              }
            });
            if (nearestCoords && (shortestDistance * 1000 < 10)){ // Only within 10m
              console.log(`Fixed bus position: ${s.no} - ${(shortestDistance * 1000).toFixed(3)}m`)
              s.next = {
                lng: nearestCoords[0],
                lat: nearestCoords[1]
              }
            }
          }
          return s;
        });
        map.getSource('buses').setData({
          type: 'FeatureCollection',
          features: servicesWithFixedCoords.map(s => ({
            type: 'Feature',
            id: encode(s.no),
            properties: {
              number: s.no,
            },
            geometry: {
              type: 'Point',
              coordinates: [s.next.lng, s.next.lat],
            },
          })),
        });
      }, map.loaded() ? 0 : 1000);

      this._arrivalsTimeout = setTimeout(() => {
        requestAnimationFrame(this._fetchServices);
      }, 15 * 1000); // 15 seconds
    });
  }
  componentWillUnmount() {
    clearTimeout(this._arrivalsTimeout);
  }
  render(props, state) {
    const { services } = props;
    const { isLoading, servicesArrivals } = state;
    const route = getRoute();
    return (
      <p class={`services-list ${isLoading ? 'loading' : ''}`}>
        {services.sort(sortServices).map(service => ([
          <a
            href={`#/services/${service}`}
            class={`service-tag ${route.page === 'service' && service === route.value ? 'current' : ''}`}>
            {service}
            {servicesArrivals[service] && <span>{timeDisplay(servicesArrivals[service])}</span>}
          </a>,
          ' '
        ]))}
      </p>
    );
  }
}

let raqST;
const raqScrollTop = () => {
  window.scrollTo(0, 0);
  raqST = requestAnimationFrame(raqScrollTop);
};

const $tooltip = document.getElementById('tooltip');
function showStopTooltip(data) {
  $tooltip.innerHTML = `<span class="stop-tag">${data.number}</span> ${data.name}`;
  $tooltip.classList.add('show');
  const { x, y: top } = data;
  const left = Math.max(5, Math.min(window.innerWidth - $tooltip.offsetWidth - 5, x - 5));
  $tooltip.style.transform = `translate(${left}px, ${top}px)`;
}
function hideStopTooltip() {
  $tooltip.classList.remove('show');
}

function getWalkingMinutes(distance) { // meters
  const walkingSpeed = 1.4; // meter/second
  return Math.ceil(distance / walkingSpeed / 60);
}

function getDistance(x1, y1, x2, y2) {
  let xs = x2 - x1;
  let ys = y2 - y1;
  xs *= xs;
  ys *= ys;
  return Math.sqrt(xs + ys);
};

class BetweenRoutes extends Component {
  render(props, state) {
    const { results, nearbyStart, nearbyEnd, onClickRoute } = props;
    if (!results.length) {
      return (<div class="between-block between-nada">😔 No routes available.</div>);
    }

    return (
      <div class="between-block">
        {results.map(result => {
          const { stopsBetween } = result;
          return (
            <div class={`between-item ${nearbyStart ? 'nearby-start' : ''}  ${nearbyEnd ? 'nearby-end' : ''}`} onClick={(e) => onClickRoute(e, result)}>
              <div class="between-inner">
                <div class={`between-services ${result.endService ? '' : 'full'}`}>
                  <span class="start">{result.startService}</span>
                  {!!result.endService && <span class="end">{result.endService}</span>}
                </div>
                <div class={`between-stops ${stopsBetween.length ? '' : 'nada'}`}>
                  {result.startStop && <span class="start">{result.startStop.number}</span>}
                  <span class={`betweens betweens-${Math.min(6, stopsBetween.length)}`}>
                    {!!stopsBetween.length && (
                      stopsBetween.length === 1 ? stopsBetween[0] : `${stopsBetween.length} stops`
                    )}
                  </span>
                  {result.endStop && <span class="end">{result.endStop.number}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}

window.requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

class App extends Component {
  constructor() {
    super();
    this.state = {
      route: getRoute(),
      services: [],
      stops: [],
      searching: false,
      expandSearch: false,
      expandedSearchOnce: false,
      shrinkSearch: false,
      showStopPopover: false,
      showBetweenPopover: false,
      showArrivalsPopover: false,
      betweenStartStop: null,
      betweenEndStop: null,
      showAd: false,
    };
    window.onhashchange = () => {
      this.setState({
        route: getRoute(),
      });
    };
  }
  async componentDidMount() {
    const mapboxScriptP = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.onload = resolve;
      s.src = 'https://api.tiles.mapbox.com/mapbox-gl-js/v0.51.0/mapbox-gl.js';
      document.getElementsByTagName('head')[0].appendChild(s);
    });

    const CACHE_TIME = 24 * 60; // 1 day
    const fetchStopsP = fetchCache(stopsJSONPath, CACHE_TIME);
    const fetchServicesP = fetchCache(servicesJSONPath, CACHE_TIME);
    const fetchRoutesP = fetchCache(routesJSONPath, CACHE_TIME);

    // Init data

    const stops = await fetchStopsP;
    const stopsData = {};
    const stopsDataArr = [];
    Object.keys(stops).forEach(number => {
      const [lng, lat, name, left] = stops[number];
      stopsData[number] = {
        name,
        number,
        interchange: /\sint$/i.test(name) && !/^(bef|aft|opp|bet)\s/i.test(name),
        coordinates: [lng, lat],
        services: [],
        routes: [],
        left: !!left,
      };
      stopsDataArr.push(stopsData[number]);
    });
    stopsDataArr.sort((a, b) => a.interchange ? 1 : b.interchange ? -1 : 0);

    const servicesData = await fetchServicesP;
    const servicesDataArr = [];
    Object.keys(servicesData).forEach(number => {
      const { name, routes } = servicesData[number];
      servicesDataArr.push({
        number,
        name,
      });
      routes.forEach((route, i) => {
        route.forEach(stop => {
          if (!stopsData[stop].services.includes(number)) {
            stopsData[stop].services.push(number);
            stopsData[stop].routes.push(number + '-' + i);
          }
        });
      });
    });
    servicesDataArr.sort((a, b) => sortServices(a.number, b.number));

    const routesData = await fetchRoutesP;
    const data = window._data = { servicesData, stopsData, stopsDataArr, routesData, servicesDataArr };
    this.setState({ ...data, services: servicesDataArr });

    // Init map
    await mapboxScriptP;
    if (!mapboxgl.supported()) {
      redirectToOldSite();
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    const lowerLat = 1.2, upperLat = 1.48, lowerLong = 103.59, upperLong = 104.05;
    const map = this.map = window._map = new mapboxgl.Map({
      container: 'map',
      style: `https://maps.tilehosting.com/c/9fdb169d-8076-44bb-a5e6-3e48a4604f35/styles/busrouter-sg-1/style.json?key=${MAPTILER_KEY}`,
      renderWorldCopies: false,
      boxZoom: false,
      minZoom: 8,
      logoPosition: 'top-right',
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      bounds: [lowerLong, lowerLat, upperLong, upperLat],
    });
    map.touchZoomRotate.disableRotation();

    // Controls
    map.addControl(new mapboxgl.AttributionControl({
      compact: true
    }), 'top-right');
    map.addControl(new mapboxgl.NavigationControl({
      showCompass: false,
    }), 'top-right');
    map.addControl(new mapboxgl.GeolocateControl({
      fitBoundsOptions: {
        maxZoom: 16,
      },
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    }));

    map.fitBounds([lowerLong, lowerLat, upperLong, upperLat], {
      animate: false,
      padding: BREAKPOINT() ? 120 : { top: 40, bottom: window.innerHeight / 2, left: 40, right: 40 },
    });

    const loadImage = async (path, name) => {
      await new Promise((resolve, reject) => {
        map.loadImage(path, (e, img) => {
          if (e) reject(e);
          map.addImage(name, img);
          resolve();
        });
      });
    };

    const mapboxLoadP = new Promise((resolve, reject) => {
      map.on('load', () => {
        Promise.all([
          loadImage(stopImagePath, 'stop'),
          loadImage(stopEndImagePath, 'stop-end'),
        ]).then(resolve);
      });
    });

    map.once('zoomstart', () => {
      $logo.classList.add('fadeout');
      this.setState({
        shrinkSearch: true,
      });
    });

    let labelLayerId;
    const mapCanvas = map.getCanvas();
    map.once('styledata', () => {
      const layers = map.getStyle().layers;
      console.log(layers);

      labelLayerId = layers.find(l => l.type == 'symbol' && l.layout['text-field']).id;
    });

    await mapboxLoadP;

    map.addSource('stops', {
      type: 'geojson',
      tolerance: 10,
      buffer: 0,
      data: {
        type: 'FeatureCollection',
        features: stopsDataArr.map(stop => ({
          type: 'Feature',
          id: encode(stop.number),
          properties: {
            number: stop.number,
            name: stop.name,
            interchange: stop.interchange,
            left: stop.left,
          },
          geometry: {
            type: 'Point',
            coordinates: stop.coordinates,
          },
        })),
      },
    });

    const stopText = {
      layout: {
        'text-optional': true,
        'text-field': [
          'step', ['zoom'],
          '',
          14, ['get', 'number'],
          16, ['concat', ['get', 'number'], '\n', ['get', 'name']]
        ],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          14, 11,
          16, 14
        ],
        'text-justify': ['case', ['boolean', ['get', 'left'], false], 'right', 'left'],
        'text-anchor': ['case', ['boolean', ['get', 'left'], false], 'top-right', 'top-left'],
        'text-offset': ['case', ['boolean', ['get', 'left'], false], ['literal', [-1, -.5]], ['literal', [1, -.5]]],
        'text-padding': .5,
        'text-font': ['Roboto Medium', 'Noto Sans Regular'],
      },
      paint: {
        'text-color': '#f01b48',
        'text-halo-width': 1,
        'text-halo-color': 'rgba(255,255,255,.9)',
      },
    };

    map.addLayer({
      id: 'stops-icon',
      type: 'symbol',
      source: 'stops',
      filter: ['any', ['>=', ['zoom'], 14], ['get', 'interchange']],
      layout: {
        'symbol-z-order': 'source',
        'icon-image': 'stop',
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          14, .4,
          16, .6
        ],
        'icon-padding': .5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        ...stopText.layout,
      },
      paint: {
        'icon-opacity': [
          'interpolate', ['linear'], ['zoom'],
          8, ['case', ['get', 'interchange'], 1, 0],
          14, 1
        ],
        ...stopText.paint,
      },
    }, 'place_city');

    map.addLayer({
      id: 'stops',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, ['case', ['boolean', ['feature-state', 'selected'], false], 4, .75],
          14, 4,
          15, ['case', ['boolean', ['feature-state', 'selected'], false], 12, 6]
        ],
        'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#fff', '#f01b48'],
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#f01b48', '#fff'],
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 5, 1],
        'circle-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10, 1,
          13.9, 1,
          14, .5
        ],
        'circle-stroke-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10, ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
          13.5, 1,
          14, .5
        ],
      },
    }, 'stops-icon');

    requestIdleCallback(() => {
      map.on('mouseenter', 'stops', () => {
        mapCanvas.style.cursor = 'pointer';
      });
      map.on('click', (e) => {
        const { point } = e;
        const features = map.queryRenderedFeatures(point, { layers: ['stops', 'stops-icon', 'stops-highlight'] });
        if (features.length) {
          const zoom = map.getZoom();
          const feature = features[0];
          const center = feature.geometry.coordinates;
          if (zoom < 12) {
            // Slowly zoom in first
            map.flyTo({ zoom: zoom + 2, center });
            this.setState({
              shrinkSearch: true,
            });
          } else {
            if (feature.source == 'stops') {
              location.hash = `/stops/${feature.properties.number}`
            } else {
              this._showStopPopover(feature.properties.number);
            }
          }
        } else {
          const { page, subpage } = this.state.route;
          if (page === 'stop' && subpage !== 'routes') {
            location.hash = '/'
          } else {
            this._hideStopPopover();
          }
        }
      });
      if (supportsHover) {
        let lastFeature = null;
        let lastFrame = null;
        map.on('mousemove', (e) => {
          const { point } = e;
          const features = map.queryRenderedFeatures(point, { layers: ['stops', 'stops-highlight'] });
          if (features.length && map.getZoom() < 16) {
            if (lastFeature && features[0].id === lastFeature.id) {
              return;
            }
            lastFeature = features[0];
            const stopID = decode(features[0].id);
            const data = stopsData[stopID];
            if (lastFrame) cancelAnimationFrame(lastFrame);
            lastFrame = requestAnimationFrame(() => {
              showStopTooltip({
                ...data,
                ...point,
              });
            });
          } else if (lastFeature) {
            lastFeature = null;
            hideStopTooltip();
          }
        });
      }
      map.on('mouseleave', 'stops', () => {
        mapCanvas.style.cursor = '';
        hideStopTooltip();
      });
      map.on('movestart', hideStopTooltip);
    });

    map.addSource('stops-highlight', {
      type: 'geojson',
      tolerance: 10,
      buffer: 0,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    map.addLayer({
      id: 'stops-highlight',
      type: 'symbol',
      source: 'stops-highlight',
      filter: ['any', ['>', ['zoom'], 10], ['==', ['get', 'type'], 'end']],
      layout: {
        'icon-image': ['case', ['==', ['get', 'type'], 'end'], 'stop-end', 'stop'],
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          8, .3,
          10, ['case', ['==', ['get', 'type'], 'end'], .3, .2],
          15, ['case', ['==', ['get', 'type'], 'end'], .45, .6]
        ],
        'icon-anchor': ['case', ['==', ['get', 'type'], 'end'], 'bottom', 'center'],
        'icon-padding': .5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        ...stopText.layout,
        'text-field': [
          'step', ['zoom'],
          ['case', ['==', ['get', 'type'], 'end'], ['concat', ['get', 'number'], '\n', ['get', 'name']], ''],
          12, ['case', ['==', ['get', 'type'], 'end'], ['concat', ['get', 'number'], '\n', ['get', 'name']], ['get', 'number']],
          16, ['concat', ['get', 'number'], '\n', ['get', 'name']]
        ],
        'text-offset': ['case', ['==', ['get', 'type'], 'end'],
          ['case', ['boolean', ['get', 'left'], false], ['literal', [-1, -1.5]], ['literal', [1, -1.5]]],
          ['case', ['boolean', ['get', 'left'], false], ['literal', [-1, -.5]], ['literal', [1, -.5]]]
        ],
      },
      paint: stopText.paint,
    });
    map.addLayer({
      id: 'stops-highlight-selected',
      type: 'circle',
      source: 'stops-highlight',
      filter: ['any', ['>', ['zoom'], 10], ['==', ['get', 'type'], 'end']],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, 4,
          15, 12
        ],
        'circle-color': '#fff',
        'circle-stroke-color': '#f01b48',
        'circle-stroke-width': 5,
        'circle-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], .5, 0],
        'circle-stroke-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], .5, 0],
      }
    }, 'stops-highlight');

    requestIdleCallback(() => {
      map.on('mouseenter', 'stops-highlight', () => {
        mapCanvas.style.cursor = 'pointer';
      });
      map.on('mouseleave', 'stops-highlight', () => {
        mapCanvas.style.cursor = '';
      });
    });

    // Bus service routes
    map.addSource('routes', {
      type: 'geojson',
      tolerance: 1,
      buffer: 0,
      lineMetrics: true,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: 'routes-bg',
      type: 'line',
      source: 'routes',
      layout: {
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#fff',
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          12, 1,
          22, 0
        ],
        'line-width': 6,
        'line-offset': [
          'interpolate', ['linear'], ['zoom'],
          12, 0,
          16, -3,
          22, ['*', ['zoom'], -3]
        ],
      },
    }, labelLayerId);

    map.addLayer({
      id: 'routes',
      type: 'line',
      source: 'routes',
      layout: {
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#f01b48',
        'line-gradient': [
          'interpolate', ['linear'], ['line-progress'],
          0, '#f01b48',
          .5, '#972FFE',
          1, '#f01b48'
        ],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          12, .9,
          16, .4
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          12, 2,
          16, 5,
          22, 10
        ],
        'line-offset': [
          'interpolate', ['linear'], ['zoom'],
          12, 0,
          16, -3,
          22, ['*', ['zoom'], -3]
        ],
      },
    }, labelLayerId);

    map.addLayer({
      id: 'route-arrows',
      type: 'symbol',
      source: 'routes',
      minzoom: 12,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 100,
        'text-field': '→',
        'text-size': 16,
        'text-font': ['Roboto Medium', 'Noto Sans Regular'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-keep-upright': false,
        'text-anchor': 'bottom',
        'text-padding': 0,
        'text-line-height': 1,
        'text-offset': [
          'interpolate', ['linear'], ['zoom'],
          12, ['literal', [0, 0]],
          22, ['literal', [0, -2]]
        ],
      },
      paint: {
        'text-color': '#5301a4',
        'text-opacity': .9,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });

    // Bus service routes (passing, overlapping)
    map.addSource('routes-path', {
      type: 'geojson',
      tolerance: 1,
      buffer: 0,
      lineMetrics: true,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: 'routes-path',
      type: 'line',
      source: 'routes-path',
      layout: {
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#f01b48',
        'line-gradient': [
          'interpolate', ['linear'], ['line-progress'],
          0, '#f01b48',
          .5, '#972FFE',
          1, '#f01b48'
        ],
        'line-opacity': ['case',
          ['boolean', ['feature-state', 'hover'], false],
          1,
          ['boolean', ['feature-state', 'fadein'], false],
          .1,
          .7 // default
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 2,
          14, 10,
        ],
      },
    }, 'stops-highlight');

    map.addLayer({
      id: 'routes-path-bg',
      type: 'line',
      source: 'routes-path',
      layout: {
        'line-cap': 'round',
      },
      maxzoom: 14,
      paint: {
        'line-color': ['case',
          ['boolean', ['feature-state', 'fadein'], false],
          'transparent',
          '#fff'
        ],
        'line-width': 6,
      },
    }, 'routes-path');

    map.addLayer({
      id: 'route-path-labels',
      type: 'symbol',
      source: 'routes-path',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 100,
        'text-font': ['Roboto Medium', 'Noto Sans Regular'],
        'text-field': '{service}',
        'text-size': 12,
        'text-rotation-alignment': 'viewport',
        'text-padding': 0,
        'text-line-height': 1,
      },
      paint: {
        'text-color': '#3f5711',
        'text-halo-color': '#eeffd1',
        'text-halo-width': 2,
        'text-opacity': ['case',
          ['boolean', ['feature-state', 'fadein'], false],
          .1,
          1
        ],
      },
    });

    requestIdleCallback(() => {
      let hoveredRouteID;
      map.on('mouseenter', 'routes-path', () => {
        mapCanvas.style.cursor = 'pointer';
      });
      map.on('click', 'routes-path', (e) => {
        if (e.features.length) {
          const { id } = e.features[0];
          location.hash = `/services/${decode(id)}`;
        }
      });
      map.on('mousemove', 'routes-path', (e) => {
        if (e.features.length) {
          const currentHoveredRouteID = e.features[0].id;
          if (hoveredRouteID && hoveredRouteID === currentHoveredRouteID) return;

          if (hoveredRouteID) {
            map.setFeatureState({
              source: 'routes-path',
              id: hoveredRouteID,
            }, { hover: false, fadein: false });
          }

          hoveredRouteID = currentHoveredRouteID;
          map.setFeatureState({
            source: 'routes-path',
            id: hoveredRouteID,
          }, { hover: true, fadein: false });

          STORE.routesPathServices.forEach(service => {
            const id = encode(service);
            if (hoveredRouteID === id) return;
            map.setFeatureState({
              source: 'routes-path',
              id,
            }, { hover: false, fadein: true });
          });

          this._highlightRouteTag(decode(hoveredRouteID));
        }
      });
      map.on('mouseleave', 'routes-path', () => {
        mapCanvas.style.cursor = '';
        if (hoveredRouteID) {
          STORE.routesPathServices.forEach(service => {
            const id = encode(service);
            map.setFeatureState({
              source: 'routes-path',
              id,
            }, { fadein: false, hover: false });
          });
          hoveredRouteID = null;
          this._highlightRouteTag();
        }
      });
    });

    // Between routes
    map.addSource('routes-between', {
      type: 'geojson',
      tolerance: 1,
      buffer: 0,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: 'routes-between',
      type: 'line',
      source: 'routes-between',
      filter: ['!=', ['get', 'type'], 'walk'],
      layout: {
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['match',
          ['get', 'type'],
          'start', '#f01b48',
          'end', '#972FFE',
          '#f01b48'
        ],
        'line-opacity': .7,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          12, 2,
          16, 5,
          22, 10
        ],
        'line-offset': [
          'interpolate', ['linear'], ['zoom'],
          12, 0,
          16, -3,
          22, ['*', ['zoom'], -3]
        ],
      },
    }, labelLayerId);

    map.addLayer({
      id: 'routes-between-walk',
      type: 'line',
      source: 'routes-between',
      filter: ['==', ['get', 'type'], 'walk'],
      paint: {
        'line-color': '#007aff',
        'line-dasharray': [2, 2],
        'line-opacity': .7,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          12, 2,
          16, 5,
          22, 10
        ],
      },
    }, 'stops-highlight');

    map.addLayer({
      id: 'routes-between-bg',
      type: 'line',
      source: 'routes-between',
      layout: {
        'line-cap': 'round',
      },
      maxzoom: 14,
      paint: {
        'line-color': '#fff',
        'line-width': 6,
      },
    }, 'routes-between');

    map.addLayer({
      id: 'route-between-arrows',
      type: 'symbol',
      source: 'routes-between',
      minzoom: 12,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 100,
        'text-field': '→',
        'text-size': 26,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-keep-upright': false,
        'text-anchor': 'bottom',
        'text-padding': 0,
        'text-line-height': 1,
        'text-offset': [
          'interpolate', ['linear'], ['zoom'],
          12, ['literal', [0, 0]],
          22, ['literal', [0, -2]]
        ],
      },
      paint: {
        'text-color': '#5301a4',
        'text-opacity': .9,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });

    this._renderRoute();

    requestIdleCallback(() => {
      // Popover search field
      this._fuseServices = new Fuse(servicesDataArr, {
        threshold: .3,
        keys: ['number', 'name'],
      });
      this._fuseStops = new Fuse(stopsDataArr, {
        threshold: .3,
        keys: ['number', 'name'],
      });

      // Global shortcuts
      let keydown = null;
      document.addEventListener('keydown', (e) => {
        const isFormField = e.target && e.target.tagName && /input|textarea|button|select/i.test(e.target.tagName);
        keydown = e.key.toLowerCase();
        switch (keydown) {
          case '/': {
            if (isFormField) return;
            e.preventDefault();
            this._searchField.focus();
            break;
          }
          case 'alt': {
            document.body.classList.add('alt-mode');
            break;
          }
          case 'escape': {
            const { expandSearch, showStopPopover, showBetweenPopover } = this.state;
            if (expandSearch) {
              this._handleSearchClose();
            } else if (showStopPopover) {
              this._hideStopPopover();
            } else if (showBetweenPopover) {
              location.hash = '/';
            }
            break;
          }
        }
      });
      document.addEventListener('keyup', () => {
        switch (keydown) {
          case 'alt': {
            document.body.classList.remove('alt-mode');
            break;
          }
        }
        keydown = null;
      });

      // Finally, show ad
      setTimeout(() => {
        this.setState({
          showAd: true,
        });
      }, 1000);
    });
  }
  _handleKeys = (e) => {
    const { services } = this.state;
    switch (e.key.toLowerCase()) {
      case 'enter': {
        const link = this._servicesList.querySelector('li a');
        if (link) {
          this._searchField.blur();
          link.click();
        }
        break;
      }
    }
  }
  _handleSearchFocus = (e) => {
    this.setState({ expandSearch: true, expandedSearchOnce: true });
    $map.classList.add('fade-out');
    raqScrollTop();
    this._searchPopover.addEventListener('transitionend', (e) => {
      cancelAnimationFrame(raqST);
    });
  }
  _handleSearch = (e) => {
    const { value } = e.target;
    if (value) {
      const services = this._fuseServices.search(value);
      let stops = [];
      if (services.length < 20) {
        stops = this._fuseStops.search(value);
      }
      this.setState({
        services,
        stops,
        searching: true,
      });
      // Scroll to top, with hack for momentum scrolling
      // https://popmotion.io/blog/20170704-manually-set-scroll-while-ios-momentum-scroll-bounces/
      this._servicesList.style['-webkit-overflow-scrolling'] = 'auto';
      this._servicesList.scrollTop = 0;
      this._servicesList.style['-webkit-overflow-scrolling'] = null;
    } else {
      this.setState({
        services: this.state.servicesDataArr,
        stops: [],
        searching: false,
      });
    }
  }
  _handleSearchClose = () => {
    this.setState({
      expandSearch: false,
    });
    $map.classList.remove('fade-out');
    this._resetSearch();
  }
  _resetSearch = () => {
    this._searchField.blur();
    this._searchField.value = '';
    this.setState({
      searching: false,
      services: this.state.servicesDataArr,
      stops: [],
    });
  }
  _handleServicesScroll = () => {
    if (this.state.expandSearch) return;
    this.setState({ expandSearch: true, expandedSearchOnce: true });
    $map.classList.add('fade-out');
  }
  _showStopPopover = (number) => {
    const map = this.map;
    const { stopsData, prevStopNumber } = this.state;
    const { services, coordinates, name } = stopsData[number];

    if (prevStopNumber) {
      this.map.setFeatureState({
        source: 'stops',
        id: encode(prevStopNumber),
      }, {
        selected: false,
      });
      this.map.setFeatureState({
        source: 'stops-highlight',
        id: encode(prevStopNumber),
      }, {
        selected: false,
      });
    }
    map.setFeatureState({
      source: 'stops',
      id: encode(number),
    }, {
      selected: true,
    });
    map.setFeatureState({
      source: 'stops-highlight',
      id: encode(number),
    }, {
      selected: true,
    });

    this.setState({
      shrinkSearch: true,
      prevStopNumber: number,
      showStopPopover: {
        number,
        name,
        services,
      },
    }, () => {
      requestAnimationFrame(() => {
        const offset = BREAKPOINT() ? [0, 0] : [0, -this._stopPopover.offsetHeight / 2];
        const zoom = map.getZoom();
        if (zoom < 16) {
          map.flyTo({
            zoom: 16,
            center: coordinates,
            offset,
            animate: zoom >= 12,
          });
        } else {
          map.easeTo({ center: coordinates, offset });
        }
      });
    });
  }
  _hideStopPopover = (e) => {
    const { page, subpage } = this.state.route;
    if (e && (page !== 'stop' || subpage === 'routes')) {
      e.preventDefault();
    }
    const map = this.map;
    let { number } = this.state.showStopPopover;
    number = number || this.state.prevStopNumber;
    if (number) {
      map.setFeatureState({
        source: 'stops',
        id: encode(number),
      }, {
        selected: false,
      });
      map.setFeatureState({
        source: 'stops-highlight',
        id: encode(number),
      }, {
        selected: false,
      });
    }
    this.setState({
      showStopPopover: false,
    });
    // Leftovers that should be handled by <BusServicesArrival/>
    const source = map.getSource('buses');
    if (source) source.setData({
      type: 'FeatureCollection',
      features: [],
    });
  }
  _zoomToStop = () => {
    const map = this.map;
    const { stopsData, showStopPopover } = this.state;
    const { number } = showStopPopover;
    const { coordinates } = stopsData[number];
    const offset = BREAKPOINT() ? [0, 0] : [0, -this._stopPopover.offsetHeight / 2];
    const zoom = map.getZoom();
    if (zoom < 16) {
      map.flyTo({
        zoom: 16,
        center: coordinates,
        offset,
      });
    } else {
      map.easeTo({ center: coordinates, offset });
    }
  }
  _highlightRouteTag = (service) => {
    const $servicesList = this._floatPill.querySelector('.services-list');
    if (!$servicesList) return;
    if (service) {
      const otherServices = $servicesList.querySelectorAll('.service-tag');
      otherServices.forEach(el => {
        el.classList.remove('highlight');
        if (el.textContent.trim() === service.trim()) {
          el.style.opacity = '';
        } else {
          el.style.opacity = .3;
        }
      });
    } else {
      $servicesList.querySelectorAll('.service-tag').forEach(el => el.style.opacity = '');
    }
  }
  _clickRoute = (e, service) => {
    const { target } = e;
    e.stopPropagation();
    if (target.classList.contains('highlight')) return;
    e.preventDefault();
    target.classList.add('highlight');
    this._highlightRoute(null, service, true);
  }
  _highlightRoute = (e, service, zoomIn) => {
    const map = this.map;

    if (e) e.target.classList.remove('highlight');
    const hoveredRouteID = encode(service);
    map.setFeatureState({
      source: 'routes-path',
      id: hoveredRouteID,
    }, { hover: true, fadein: false });

    STORE.routesPathServices.forEach(service => {
      const id = encode(service);
      if (hoveredRouteID === id) return;
      map.setFeatureState({
        source: 'routes-path',
        id,
      }, { hover: false, fadein: true });
    });

    if (zoomIn) {
      // Fit map to route bounds
      requestAnimationFrame(() => {
        const { servicesData, stopsData } = this.state;
        const { routes } = servicesData[service];
        const coordinates = routes[0].concat(routes[1] || []).map(stop => stopsData[stop].coordinates);
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(c => {
          bounds.extend(c);
        });
        const bottom = this._floatPill ? (this._floatPill.offsetHeight + 60 + 80) : 80;
        map.fitBounds(bounds, {
          padding: BREAKPOINT() ? 80 : {
            top: 80,
            right: 80,
            bottom,
            left: 80,
          },
        });
      });
    }
  }
  _unhighlightRoute = (e) => {
    if (e && e.target && e.target.classList.contains('service-tag')) {
      e.target.classList.remove('highlight');
    }
    STORE.routesPathServices.forEach(service => {
      const id = encode(service);
      this.map.setFeatureState({
        source: 'routes-path',
        id,
      }, { fadein: false, hover: false });
    });
  }
  _openBusArrival = (e, showPopup = false) => {
    if (e) e.preventDefault();
    const width = 360;
    const height = 480;
    const url = e.target.href;
    const stopNumber = url.match(/[^#]+$/)[0];
    showPopup = showPopup || (window.innerWidth > width * 2 && window.innerHeight > height) || window.innerWidth > window.innerHeight; // landscape is weird
    if (showPopup) {
      const top = ((screen.availHeight || screen.height) - height) / 2;
      const left = (screen.width - width) / 2;
      window.open(url, `busArrivals-${stopNumber}`, `width=${width},height=${height},menubar=0,toolbar=0,top=${top},left=${left}`);
    } else {
      this.setState({
        showArrivalsPopover: {
          webviewURL: url,
          number: stopNumber,
        },
      }, () => {
        $map.classList.add('fade-out');
      });
    }
  }
  _closeBusArrival = (e) => {
    if (e) e.preventDefault();
    this.setState({
      showArrivalsPopover: false,
    }, () => {
      $map.classList.remove('fade-out');
    });
  }
  _showBetweenPopover = (data) => {
    this.setState({
      shrinkSearch: true,
      showBetweenPopover: data,
    }, () => {
      // Auto-select first result
      setTimeout(() => {
        const firstResult = this._betweenPopover.querySelector('.between-item');
        firstResult.click();
      }, 300);
    });
  }
  _renderBetweenRoute = ({ e, startStop, endStop, result }) => {
    const { target } = e;
    [...target.parentElement.children].forEach(el => {
      if (el === target) {
        target.classList.add('selected');
      } else {
        el.classList.remove('selected')
      }
    });

    const map = this.map;
    const { stopsData, routesData } = this.state;
    const stops = [{ ...startStop, end: true }, { ...endStop, end: true }];
    if (result.startStop && result.startStop.number != startStop.number) {
      stops.push({ ...result.startStop, end: true });
    }
    if (result.endStop && result.endStop.number != endStop.number) {
      stops.push({ ...result.endStop, end: true });
    }
    if (result.stopsBetween.length) {
      result.stopsBetween.forEach(number => stops.push(stopsData[number]));
    }

    // Render stops
    map.getSource('stops-highlight').setData({
      type: 'FeatureCollection',
      features: stops.map(stop => ({
        type: 'Feature',
        id: encode(stop.number),
        properties: {
          name: stop.name,
          number: stop.number,
          type: stop.end ? 'end' : null,
          left: stop.left,
        },
        geometry: {
          type: 'Point',
          coordinates: stop.coordinates,
        },
      })),
    });

    requestAnimationFrame(() => {
      // Render routes
      const geometries = [];

      let [service, index] = result.startRoute.split('-');
      geometries.push(toGeoJSON(routesData[service][index]));

      if (result.endRoute) {
        let [service, index] = result.endRoute.split('-');
        geometries.push(toGeoJSON(routesData[service][index]));
      }

      if (result.startStop && result.startStop.number != startStop.number) {
        geometries.push({
          type: 'LineString',
          coordinates: [result.startStop.coordinates, startStop.coordinates],
        });
      };
      if (result.endStop && result.endStop.number != endStop.number) {
        geometries.push({
          type: 'LineString',
          coordinates: [result.endStop.coordinates, endStop.coordinates],
        });
      };
      map.getSource('routes-between').setData({
        type: 'FeatureCollection',
        features: geometries.map((geometry, i) => ({
          type: 'Feature',
          properties: {
            type: i === 0 ? 'start' : i === 1 ? 'end' : 'walk',
          },
          geometry,
        })),
      });

      // Fit map to stops bounds
      const bounds = new mapboxgl.LngLatBounds();
      stops.forEach(stop => {
        bounds.extend(stop.coordinates);
      });
      map.fitBounds(bounds, {
        padding: BREAKPOINT() ? {
          top: 80,
          right: this._betweenPopover.offsetWidth + 80,
          bottom: 80,
          left: 80,
        } : {
            top: 80,
            right: 80,
            bottom: this._betweenPopover.offsetHeight + 80,
            left: 80,
          },
      });
    });
  }
  _renderRoute = () => {
    const { servicesData, stopsData, stopsDataArr, routesData, route, prevStopNumber } = this.state;
    const map = this.map;
    console.log('Route', route);

    // Reset everything
    $map.classList.remove('fade-out');
    this.setState({
      showStopPopover: false,
      showBetweenPopover: false,
    });
    [
      'stops-highlight',
      'routes',
      'routes-path',
      'routes-between',
    ].forEach(source => {
      map.getSource(source).setData({
        type: 'FeatureCollection',
        features: [],
      });
    });
    if (prevStopNumber) {
      this._hideStopPopover();
    }

    switch (route.page) {
      case 'service': {
        const service = route.value;
        if (!servicesData[service]) return;
        const { name, routes } = servicesData[service];
        document.title = `Bus service ${service}: ${name} - ${APP_NAME}`;
        // Reset
        this.setState({
          expandSearch: false,
          shrinkSearch: true,
        });
        this._resetSearch();

        // Hide all stops
        map.setLayoutProperty('stops', 'visibility', 'none');
        map.setLayoutProperty('stops-icon', 'visibility', 'none');

        // Show stops of the selected service
        const endStops = [routes[0][0], routes[0][routes[0].length - 1]];
        if (routes[1]) endStops.push(routes[1][0], routes[1][routes[1].length - 1]);
        let routeStops = [...routes[0], ...(routes[1] || [])].filter((el, pos, arr) => {
          return arr.indexOf(el) == pos;
        }); // Merge and unique
        map.getSource('stops-highlight').setData({
          type: 'FeatureCollection',
          features: routeStops.map((stop, i) => {
            const { name, left } = stopsData[stop];
            return {
              type: 'Feature',
              id: encode(stop),
              properties: {
                name,
                number: stop,
                type: endStops.includes(stop) ? 'end' : null,
                left,
              },
              geometry: {
                type: 'Point',
                coordinates: stopsData[stop].coordinates,
              },
            };
          }),
        });

        // Show routes
        requestAnimationFrame(() => {
          const routes = routesData[service];
          const geometries = routes.map(route => toGeoJSON(route));
          map.getSource('routes').setData({
            type: 'FeatureCollection',
            features: geometries.map(geometry => ({
              type: 'Feature',
              properties: {},
              geometry,
            })),
          });
        });

        // Fit map to route bounds
        const bounds = new mapboxgl.LngLatBounds();
        routeStops.forEach(stop => {
          const { coordinates } = stopsData[stop];
          bounds.extend(coordinates);
        });
        map.fitBounds(bounds, {
          padding: BREAKPOINT() ? 80 : {
            top: 80,
            right: 80,
            bottom: 60 + 54 + 80, // height of search bar + float pill
            left: 80,
          },
        });

        break;
      }
      case 'stop': {
        const stop = route.value;
        if (!stopsData[stop]) return;

        // Reset
        this.setState({
          expandSearch: false,
          shrinkSearch: true,
        });
        this._resetSearch();

        const { routes, name, coordinates } = stopsData[stop];
        if (route.subpage === 'routes') {
          document.title = `Routes passing Bus stop ${stop}: ${name} - ${APP_NAME}`;

          // Hide all stops
          map.setLayoutProperty('stops', 'visibility', 'none');
          map.setLayoutProperty('stops-icon', 'visibility', 'none');

          // Show the all stops in all routes
          const allStopsCoords = [];
          allStopsCoords.push(coordinates);
          const otherStops = new Set();
          routes.forEach(route => {
            const [service, index] = route.split('-');
            const stops = servicesData[service].routes[index];
            stops.forEach(s => (stop !== s) && otherStops.add(s));
          });
          [...otherStops].map(s => {
            allStopsCoords.push(stopsData[s].coordinates);
          });
          map.getSource('stops-highlight').setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              id: encode(stop),
              properties: {
                name,
                number: stop,
                type: 'end',
                left: stopsData[stop].left,
              },
              geometry: {
                type: 'Point',
                coordinates,
              },
            }],
          });

          // Show all routes
          requestAnimationFrame(() => {
            const serviceGeometries = routes.map(route => {
              const [service, index] = route.split('-');
              const line = routesData[service][index];
              const geometry = toGeoJSON(line);
              return {
                service,
                geometry,
              };
            });

            map.getSource('routes-path').setData({
              type: 'FeatureCollection',
              features: serviceGeometries.map((sg, i) => ({
                type: 'Feature',
                id: encode(sg.service),
                properties: {
                  service: sg.service,
                },
                geometry: sg.geometry,
              })),
            });
            STORE.routesPathServices = serviceGeometries.map(sg => sg.service);
          });

          // Fit map to route bounds
          const bounds = new mapboxgl.LngLatBounds();
          allStopsCoords.forEach(coordinates => {
            bounds.extend(coordinates);
          });
          const bottom = this._floatPill ? (this._floatPill.offsetHeight + 60 + 80) : 80;
          map.fitBounds(bounds, {
            padding: BREAKPOINT() ? 80 : {
              top: 80,
              right: 80,
              bottom,
              left: 80,
            },
          });
        } else {
          document.title = `Bus stop ${stop}: ${name} - ${APP_NAME}`;
          map.setLayoutProperty('stops', 'visibility', 'visible');
          map.setLayoutProperty('stops-icon', 'visibility', 'visible');
          this._showStopPopover(stop);
        }
        break;
      }
      case 'between': {
        const coords = route.value;
        const [startStopNumber, endStopNumber] = coords.split(/[,-]/).map(String);
        if (!stopsData[startStopNumber] || !stopsData[endStopNumber]) {
          alert('One of the stop numbers are not found.');
          return;
        }

        document.title = `Routes between ${startStopNumber} and ${endStopNumber} - ${APP_NAME}`;
        // Reset
        this.setState({
          expandSearch: false,
          shrinkSearch: true,
        });

        // Hide all stops
        map.setLayoutProperty('stops', 'visibility', 'none');
        map.setLayoutProperty('stops-icon', 'visibility', 'none');

        function findRoutesBetween(startStop, endStop) {
          const results = [];

          const endServicesStops = endStop.routes.map(route => {
            const [service, routeIndex] = route.split('-');
            let serviceStops = servicesData[service].routes[routeIndex];
            serviceStops = serviceStops.slice(0, serviceStops.indexOf(endStop.number) + 1);
            return { service, stops: serviceStops, route };
          });

          startStop.routes.forEach(route => {
            const [service, routeIndex] = route.split('-');
            let serviceStops = servicesData[service].routes[routeIndex];
            serviceStops = serviceStops.slice(serviceStops.indexOf(startStop.number));

            // This service already can go straight to the end stop,
            // there's no need to find any connections from end stop
            if (serviceStops.includes(endStop.number)) {
              results.push({
                startService: service,
                startRoute: route,
                stopsBetween: [],
              });
            } else {
              endServicesStops.forEach(({ service: s, stops, route: r }) => {
                // console.log(serviceStops, stops);
                const intersectedStops = intersect(stops, serviceStops);
                if (intersectedStops.length) {
                  const startIndex = intersectedStops.indexOf(startStop.number);
                  if (startIndex > -1) intersectedStops.splice(startIndex, 1);
                  const endIndex = intersectedStops.indexOf(endStop.number);
                  if (endIndex > -1) intersectedStops.splice(endIndex, 1);

                  if (intersectedStops.length) {
                    results.push({
                      startStop,
                      startService: service,
                      startRoute: route,
                      stopsBetween: intersectedStops,
                      endRoute: r,
                      endService: s,
                      endStop,
                    });
                  }
                }
              });
            }
          });

          return results;
        };

        function findNearestStops(stop) {
          let distance = Infinity;
          let nearestStop = null;
          for (let i = 0, l = stopsDataArr.length; i < l; i++) {
            const s = stopsDataArr[i];
            if (s.number !== stop.number) {
              const d = getDistance(...stop.coordinates, ...s.coordinates);
              if (d < distance) {
                distance = d;
                nearestStop = s;
              }
            }
          }
          return nearestStop;
        };

        const startStop = stopsData[startStopNumber];
        const endStop = stopsData[endStopNumber];
        const nearestEndStop = findNearestStops(endStop);
        const nearestStartStop = findNearestStops(startStop);
        console.log(startStop, endStop, nearestEndStop, nearestStartStop);
        this._showBetweenPopover({
          startStop,
          endStop,
          nearestStartStop,
          nearestEndStop,
          startWalkMins: getWalkingMinutes(ruler.distance(startStop.coordinates, nearestStartStop.coordinates) * 1000),
          endWalkMins: getWalkingMinutes(ruler.distance(endStop.coordinates, nearestEndStop.coordinates) * 1000),
          results: [
            findRoutesBetween(startStop, endStop),
            findRoutesBetween(startStop, nearestEndStop),
            findRoutesBetween(nearestStartStop, endStop),
            findRoutesBetween(nearestStartStop, nearestEndStop)
          ],
        });

        break;
      }
      default: {
        document.title = `${APP_NAME} - ${APP_LONG_NAME}`;

        // Show all stops
        map.setLayoutProperty('stops', 'visibility', 'visible');
        map.setLayoutProperty('stops-icon', 'visibility', 'visible');
      }
    }
  }
  componentDidUpdate(_, prevState) {
    const { route } = this.state;
    if (route.path != prevState.route.path) {
      this._renderRoute();
    }
  }
  _setStartStop = (number) => {
    const { betweenEndStop } = this.state;
    if (betweenEndStop && betweenEndStop != number) {
      location.hash = `/between/${number}-${betweenEndStop}`;
    } else {
      this.setState({
        betweenStartStop: number,
        betweenEndStop: null,
      });
    }
  }
  _setEndStop = (number) => {
    const { betweenStartStop } = this.state;
    if (betweenStartStop && betweenStartStop != number) {
      location.hash = `/between/${betweenStartStop}-${number}`;
    } else {
      this.setState({
        betweenStartStop: null,
        betweenEndStop: number,
      });
    }
  }
  render(_, state) {
    const {
      route,
      stops,
      services,
      searching,
      expandSearch,
      expandedSearchOnce,
      servicesData,
      stopsData,
      shrinkSearch,
      showStopPopover,
      showBetweenPopover,
      showArrivalsPopover,
      showAd,
    } = state;

    const popoverIsUp = !!showStopPopover || !!showBetweenPopover || !!showArrivalsPopover;

    return (
      <div>
        <div
          id="search-popover"
          ref={c => this._searchPopover = c}
          class={`popover ${expandSearch ? 'expand' : ''} ${shrinkSearch ? 'shrink' : ''}`}
        >
          <div id="popover-float" hidden={!/service|stop/.test(route.page)}>
            {route.page === 'service' && servicesData ? (
              <div class="float-pill" ref={c => this._floatPill = c}>
                <a href="#/" class="popover-close">&times;</a>
                <div class="service-flex">
                  <span class="service-tag">{route.value}</span>
                  <div class="service-info">
                    <h1>{servicesData[route.value].name}</h1>
                    <p>
                      {servicesData[route.value].routes.length} route{servicesData[route.value].routes.length > 1 ? 's' : ''} ∙&nbsp;
                      {servicesData[route.value].routes.map(r => `${r.length} stop${r.length > 1 ? 's' : ''}`).join(' ∙ ')}
                    </p>
                  </div>
                </div>
              </div>
            ) : route.page === 'stop' && route.subpage === 'routes' && stopsData && (
              <div class="float-pill" ref={c => this._floatPill = c}>
                <a href="#/" class="popover-close">&times;</a>
                <div class="service-flex">
                  <span class="stop-tag">{route.value}</span>
                  <div>
                    <h1>{stopsData[route.value].name}</h1>
                    <p>{stopsData[route.value].services.length} passing routes</p>
                  </div>
                </div>
                <div class="services-list" onClick={this._unhighlightRoute}>
                  {stopsData[route.value].services.sort(sortServices).map(service => (
                    <a
                      href={`#/services/${service}`}
                      onClick={(e) => this._clickRoute(e, service)}
                      onMouseEnter={(e) => this._highlightRoute(e, service)}
                      onMouseLeave={this._unhighlightRoute}
                      class="service-tag"
                    >
                      {service}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div class="popover-search">
            <input
              type="search"
              placeholder="Search for bus service or stop"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              ref={c => this._searchField = c}
              onfocus={this._handleSearchFocus}
              oninput={this._handleSearch}
              onkeydown={this._handleKeys}
              disabled={(!searching && !services.length) || popoverIsUp}
            />
            <button type="button" onclick={this._handleSearchClose}>Cancel</button>
          </div>
          <ul class={`popover-list ${services.length || searching ? '' : 'loading'} ${searching ? 'searching' : ''}`} ref={c => this._servicesList = c} onScroll={this._handleServicesScroll}>
            <li class="carbon-li" hidden={!services.length || !showAd}>
              {services.length && showAd && <Ad key="ad" />}
            </li>
            {services.length ? (
              (expandedSearchOnce ? services : services.slice(0, 10)).map(s => (
                <li key={s.number}>
                  <a href={`#/services/${s.number}`} class={route.page === 'service' && s.number === route.value ? 'current' : ''}>
                    <b class="service-tag">{s.number}</b> {s.name}
                  </a>
                </li>
              ))
            ) : !searching && (
              [1, 2, 3, 4, 5, 6, 7, 8].map((s, i) => (
                <li key={s}>
                  <a href="#">
                    <b class="service-tag">&nbsp;&nbsp;&nbsp;</b>
                    <span class="placeholder">█████{i % 3 == 0 ? '███' : ''} ███{i % 2 == 0 ? '████' : ''}</span>
                  </a>
                </li>
              ))
            )}
            {searching && !!stops.length && (
              stops.map(s => (
                <li key={s.number}>
                  <a href={`#/stops/${s.number}`}>
                    <b class="stop-tag">{s.number}</b> {s.name}
                  </a>
                </li>
              ))
            )}
            {searching && !stops.length && !services.length && (
              <li class="nada">No results.</li>
            )}
          </ul>
        </div>
        <div id="between-popover" ref={c => this._betweenPopover = c} class={`popover ${showBetweenPopover ? 'expand' : ''}`}>
          {showBetweenPopover && [
            <a href="#/" class="popover-close">&times;</a>,
            <header>
              <h1>
                <small>Routes between</small><br />
                <b class="stop-tag">{showBetweenPopover.startStop.number}</b> and <b class="stop-tag">{showBetweenPopover.endStop.number}</b>
              </h1>
            </header>,
            <div class="popover-scroll">
              <div class="disclaimer">
                This is a beta feature. Directions and routes may not be correct.
              </div>
              <h2>Direct routes</h2>
              <BetweenRoutes results={showBetweenPopover.results[0]} onClickRoute={(e, result) => this._renderBetweenRoute({
                e,
                startStop: showBetweenPopover.startStop,
                endStop: showBetweenPopover.endStop,
                result,
              })} />
              <h2>Alternative routes</h2>
              <h3>Nearby arrival stop: {showBetweenPopover.nearestEndStop.number} ({showBetweenPopover.endWalkMins}-min walk)</h3>
              <BetweenRoutes results={showBetweenPopover.results[1]} nearbyEnd={true} onClickRoute={(e, result) => this._renderBetweenRoute({
                e,
                startStop: showBetweenPopover.startStop,
                endStop: showBetweenPopover.endStop,
                result,
              })} />
              <h3>Nearby departure stop: {showBetweenPopover.nearestStartStop.number} ({showBetweenPopover.startWalkMins}-min walk)</h3>
              <BetweenRoutes results={showBetweenPopover.results[2]} nearbyStart={true} onClickRoute={(e, result) => this._renderBetweenRoute({
                e,
                startStop: showBetweenPopover.startStop,
                endStop: showBetweenPopover.endStop,
                result,
              })} />
              <h3>Nearby departure &amp; arrival stops: {showBetweenPopover.nearestStartStop.number} - {showBetweenPopover.nearestEndStop.number}</h3>
              <BetweenRoutes results={showBetweenPopover.results[3]} nearbyStart={true} nearbyEnd={true} onClickRoute={(e, result) => this._renderBetweenRoute({
                e,
                startStop: showBetweenPopover.startStop,
                endStop: showBetweenPopover.endStop,
                result,
              })} />
            </div>
          ]}
        </div>
        <div id="stop-popover" ref={c => this._stopPopover = c} class={`popover ${showStopPopover ? 'expand' : ''}`}>
          {showStopPopover && [
            <a href="#/" onClick={this._hideStopPopover} class="popover-close">&times;</a>,
            <header>
              <h1 onClick={this._zoomToStop}><b class="stop-tag">{showStopPopover.number}</b> {showStopPopover.name}</h1>
              <h2>{showStopPopover.services.length} service{showStopPopover.services.length == 1 ? '' : 's'}</h2>
            </header>,
            <div class="popover-scroll">
              <BusServicesArrival map={this.map} id={showStopPopover.number} services={showStopPopover.services} />
            </div>,
            <div class="popover-footer">
              <div class="popover-buttons alt-hide">
                <a href={`/bus-arrival/#${showStopPopover.number}`} target="_blank" onClick={this._openBusArrival} class="popover-button">Bus arrivals <img src={openNewWindowImagePath} width="16" height="16" alt="" /></a>
                {showStopPopover.services.length > 1 && (
                  <a href={`#/stops/${showStopPopover.number}/routes`} class="popover-button">Passing routes <img src={passingRoutesImagePath} width="16" height="16" alt="" /></a>
                )}
              </div>
              <div class="popover-buttons alt-show-flex">
                <button onClick={() => this._setStartStop(showStopPopover.number)} class="popover-button">Set as Start</button>
                <button onClick={() => this._setEndStop(showStopPopover.number)} class="popover-button">Set as End</button>
              </div>
            </div>
          ]}
        </div>
        <div id="arrivals-popover" class={`popover ${showArrivalsPopover ? 'expand' : ''}`}>
          {showArrivalsPopover && [
            <a href="#/" onClick={this._closeBusArrival} class="popover-close">&times;</a>,
            <a href={`/bus-arrival/#${showArrivalsPopover.number}`} target="_blank" onClick={(e) => {
              this._openBusArrival(e, true);
              this._closeBusArrival(e);
            }} class="popover-popout popover-close">Pop out <img src={openNewWindowImagePath} width="16" height="16" alt="" /></a>,
            <div class="popover-scroll">
              <iframe src={showArrivalsPopover.webviewURL}></iframe>
            </div>
          ]}
        </div>
      </div>
    );
  }
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../service-worker.js');
  });
}

if (window.navigator.standalone) {
  document.body.classList.add('standalone');

  // Refresh map size when dimissing software keyboard
  // https://stackoverflow.com/a/19464029/20838
  document.addEventListener('focusout', () => {
    if (_map) _map.resize();
  });

  // Enable CSS active states
  document.addEventListener('touchstart', () => {}, false);
}

const isSafari = navigator.vendor && navigator.vendor.indexOf('Apple') !== -1;
if (isSafari && !window.navigator.standalone) {
  setTimeout(function(){
    const ratio = window.devicePixelRatio;
    const canvas = document.createElement('canvas');
    const w = canvas.width = window.screen.width * ratio;
    const h = canvas.height = window.screen.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F9F5ED';
    ctx.fillRect(0, 0, w, h);
    const icon = new Image();
    icon.onload = () => {
      const aspectRatio = icon.width / icon.height;
      icon.width = w/2;
      icon.height = w/2/aspectRatio;
      ctx.drawImage(icon, (w - icon.width)/2, (h - icon.height)/2, icon.width, icon.height);
      document.head.insertAdjacentHTML('beforeend', `<link rel="apple-touch-startup-image" href="${canvas.toDataURL()}">`);
    };
    icon.src = iconSVGPath;
  }, 5000);
}