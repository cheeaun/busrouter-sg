import { h, render, Component } from 'preact';
import { toGeoJSON } from '@mapbox/polyline';
import Fuse from 'fuse.js';
import { encode, decode } from '../utils/specialID';
import { timeDisplay, sortServices } from '../utils/bus';
import { MAPBOX_ACCESS_TOKEN } from './config';

import stopImagePath from './images/stop.png';
import stopSmallImagePath from './images/stop-small.png';
import stopStartImagePath from './images/stop-start.png';
import stopEndImagePath from './images/stop-end.png';
import openNewWindowImagePath from './images/open-new-window.svg';
import passingRoutesImagePath from './images/passing-routes.svg';

import routesJSONPath from '../data/3/routes.polyline.json';
import stopsJSONPath from '../data/3/stops.final.json';
import servicesJSONPath from '../data/3/services.final.json';

const $map = document.getElementById('map');
const STORE = {};
const BREAKPOINT = () => window.innerWidth > 640 && window.innerHeight > 640;

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

const $logo = document.getElementById('logo');
const $about = document.getElementById('about');
const $closeAbout = document.getElementById('close-about');

$closeAbout.onclick = $logo.onclick = () => {
  $about.hidden = !$about.hidden;
  try {
    localStorage.setItem('busroutersg.about', 'true');
  } catch(e){}
}
try {
  const intro = localStorage.getItem('busroutersg.about');
  if (intro !== 'true') $about.hidden = false;
} catch(e){}

const getRoute = () => {
  const path = location.hash.replace(/^#/, '') || '/';
  if (path === '/') return { page: 'home' };
  let [_, page, value] = path.match(/(service|stop)s\/([^\/]+)/) || [];
  return { page, value, path };
};

class BusServicesArrival extends Component {
  state = {
    isLoading: false,
    servicesArrivals: {},
  }
  componentDidMount(){
    this._fetchServices();
  }
  componentDidUpdate(prevProps){
    if (prevProps.id !== this.props.id){
      clearTimeout(this._arrivalsTimeout);
      this.setState({
        servicesArrivals: {},
      });
      this._fetchServices();
    }
  }
  _arrivalsTimeout = null;
  _fetchServices = () => {
    const { id } = this.props;
    if (!id) return;
    this.setState({ isLoading: true });
    fetch(`https://arrivelah.appspot.com/?id=${id}`).then(res => res.json()).then(results => {
      const servicesArrivals = {};
      results.services.forEach(service => servicesArrivals[service.no] = service.next.duration_ms);
      this.setState({
        isLoading: false,
        servicesArrivals,
      });
      this._arrivalsTimeout = setTimeout(() => {
        requestAnimationFrame(this._fetchServices);
      }, 15*1000); // 15 seconds
    });
  }
  componentWillUnmount(){
    clearTimeout(this._arrivalsTimeout);
  }
  render(props, state){
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

class App extends Component {
  constructor(){
    super();
    this.state = {
      route: getRoute(),
      services: [],
      expandSearch: false,
      shrinkSearch: false,
      showStopPopover: false,
    };
    window.onhashchange = () => {
      this.setState({
        route: getRoute(),
      });
    };
  }
  async componentDidMount(){
    const map = this.map = window._map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v10?optimized=true',
      renderWorldCopies: false,
      boxZoom: false,
      minZoom: 8,
      logoPosition: 'top-right',
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
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
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    }));

    const lowerLat = 1.2, upperLat = 1.48, lowerLong = 103.59, upperLong = 104.05;
    map.fitBounds([lowerLong, lowerLat, upperLong, upperLat], {
      animate: false,
      padding: BREAKPOINT() ? 120 : {top: 40, bottom: window.innerHeight/2, left: 40, right: 40},
    });

    map.once('zoomstart', () => {
      $logo.classList.add('fadeout');
      this.setState({
        shrinkSearch: true,
      });
    });

    let labelLayerId;
    map.once('styledata', () => {
      const layers = map.getStyle().layers;
      console.log(layers);

      labelLayerId = layers.find(l => l.type == 'symbol' && l.layout['text-field']).id;

      // Apple Maps colors
      map.setPaintProperty('background', 'background-color', '#F9F5ED');
      map.setPaintProperty('water', 'fill-color', '#AEE1F5');

      // Fade out road colors at low zoom levels
      ['road-trunk', 'road-motorway'].forEach(l => {
        map.setPaintProperty(l, 'line-opacity', [
          'interpolate', ['linear'], ['zoom'],
          10, .5,
          15, 1
        ]);
      });

      // Remove useless layers
      layers.filter(l => /^(hillshade|ferry|admin)/i.test(l.id)).forEach(l => {
        map.removeLayer(l.id);
      });

      // The road shields are quite annoying at low zoom levels
      map.setLayerZoomRange('road-shields-black', 12, 24);
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

    let routesData = {},
      stopsData = {},
      stopsDataArr = [],
      servicesData = {},
      servicesDataArr = [];

    let stops;
    [stops, servicesData, routesData] = await Promise.all([
      fetch(stopsJSONPath).then(r => r.json()),
      fetch(servicesJSONPath).then(r => r.json()),
      fetch(routesJSONPath).then(r => r.json()),
      new Promise((resolve, reject) => {
        map.on('load', resolve);
      }),
    ]);

    Object.keys(stops).forEach(number => {
      const [lng, lat, name] = stops[number];
      stopsData[number] = {
        name,
        number,
        coordinates: [lng, lat],
        services: [],
        routes: [],
      };
      stopsDataArr.push({
        number,
        name,
        coordinates: [lng, lat],
      });
    });

    Object.keys(servicesData).forEach(number => {
      const { name, routes } = servicesData[number];
      servicesDataArr.push({
        number,
        name,
      });
      routes.forEach((route, i) => {
        route.forEach(stop => {
          if (!stopsData[stop].services.includes(number)){
            stopsData[stop].services.push(number);
            stopsData[stop].routes.push(number+'-'+i);
          }
        });
      });
    });

    this.setState({ servicesData, stopsData, routesData, servicesDataArr });

    map.addSource('stop-selected', {
      type: 'geojson',
      tolerance: 3.5,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    map.addLayer({
      id: 'stop-selected',
      type: 'circle',
      source: 'stop-selected',
      paint: {
        'circle-opacity': .5,
        'circle-blur': [
          'interpolate', ['linear'], ['zoom'],
          10, 0,
          14, .9
        ],
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, 2.5,
          14, 44
        ],
        'circle-color': '#f01b48',
      },
    }, 'place-neighbourhood');

    map.addSource('stops', {
      type: 'geojson',
      tolerance: 3.5,
      data: {
        type: 'FeatureCollection',
        features: stopsDataArr.map(stop => ({
          type: 'Feature',
          id: encode(stop.number),
          properties: {
            number: stop.number,
            name: stop.name,
          },
          geometry: {
            type: 'Point',
            coordinates: stop.coordinates,
          },
        })),
      },
    });

    await loadImage(stopSmallImagePath, 'stop-small');
    await loadImage(stopImagePath, 'stop');
    await loadImage(stopStartImagePath, 'stop-start');
    await loadImage(stopEndImagePath, 'stop-end');

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
          22, 20
        ],
        'text-justify': 'left',
        'text-anchor': 'top-left',
        'text-offset': [1, -.6],
        'text-padding': .5,
        'text-font': ['DIN Offc Pro Medium', 'Open Sans Semibold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#f01b48',
        'text-halo-width': 1,
        'text-halo-color': '#fff',
      },
    };

    map.addLayer({
      id: 'stops',
      type: 'symbol',
      source: 'stops',
      layout: {
        'icon-image': [
          'step', ['zoom'],
          'stop-small',
          14, 'stop'
        ],
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          0, .05,
          10, .05,
          15, .6
        ],
        'icon-padding': .5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        ...stopText.layout,
      },
      paint: stopText.paint,
    }, 'place-neighbourhood');

    let hoveredStopID;
    map.on('mouseenter', 'stops', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('click', 'stops', (e) => {
      if (e.features.length){
        this._showStopPopover(e.features[0]);
      }
    });
    map.on('mousemove', 'stops', (e) => {
      if (e.features.length){
        if (hoveredStopID){
          map.setFeatureState({
            source: 'stops',
            id: hoveredStopID,
          }, { hover: false });
        }
        hoveredStopID = e.features[0].id;
        map.setFeatureState({
          source: 'stops',
          id: hoveredStopID,
        }, { hover: true });
      }
    });
    map.on('mouseleave', 'stops', () => {
      map.getCanvas().style.cursor = '';
      if (hoveredStopID){
        map.setFeatureState({
          source: 'stops',
          id: hoveredStopID,
        }, { hover: false });
        hoveredStopID = null;
      }
    });

    map.addSource('stops-highlight', {
      type: 'geojson',
      tolerance: 3.5,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    map.addLayer({
      id: 'stops-highlight',
      type: 'symbol',
      source: 'stops-highlight',
      layout: {
        'icon-image': [
          'step', ['zoom'],
          ['case', ['==', ['get', 'type'], 'end'], 'stop-end', 'stop-small'],
          14, ['case', ['==', ['get', 'type'], 'end'], 'stop-end', 'stop']
        ],
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          0, .1,
          10, ['case', ['==', ['get', 'type'], 'end'], .3, .1 ],
          15, ['case', ['==', ['get', 'type'], 'end'], .45, .6 ]
        ],
        'icon-anchor': ['case', ['==', ['get', 'type'], 'end'], 'bottom', 'center'],
        'icon-padding': .5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        ...stopText.layout,
      },
      paint: {
        'icon-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10, ['case', ['==', ['get', 'type'], 'end'], 1, 0],
          11, 1
        ],
        ...stopText.paint,
      }
    });

    map.on('mouseenter', 'stops-highlight', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('click', 'stops-highlight', (e) => {
      if (e.features.length){
        this._showStopPopover(e.features[0]);
      }
    });
    map.on('mouseleave', 'stops-highlight', () => {
      map.getCanvas().style.cursor = '';
    });

    // Bus service routes
    map.addSource('routes', {
      type: 'geojson',
      tolerance: 1.5,
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
        'line-join': 'round'
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
        'line-join': 'round'
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
        'text-size': 24,
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
        'text-opacity': .75,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });

    // Bus service routes (passing, overlapping)
    map.addSource('routes-path', {
      type: 'geojson',
      tolerance: 1.5,
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
        'line-join': 'round'
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
        'line-join': 'round'
      },
      maxzoom: 14,
      paint: {
        'line-color': ['case',
          ['boolean', ['feature-state', 'fadein'], false],
          'transparent',
          '#fff'
        ],
        'line-width': 8,
      },
    }, 'routes-path');

    map.addLayer({
      id: 'route-path-labels',
      type: 'symbol',
      source: 'routes-path',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 100,
        'text-font': ['DIN Offc Pro Medium', 'Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-field': '{service}',
        'text-size': 10,
        'text-rotation-alignment': 'viewport',
        'text-padding': 0,
        'text-line-height': 1,
      },
      paint: {
        'text-halo-color': 'rgba(255,255,255,.9)',
        'text-halo-width': 2,
        'text-opacity': ['case',
          ['boolean', ['feature-state', 'fadein'], false],
          .1,
          1
        ],
      },
    });

    let hoveredRouteID;
    map.on('mouseenter', 'routes-path', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('click', 'routes-path', (e) => {
      if (e.features.length){
        const { id } = e.features[0];
        location.hash = `/services/${decode(id)}`;
      }
    });
    map.on('mousemove', 'routes-path', (e) => {
      if (e.features.length){
        const currentHoveredRouteID = e.features[0].id;
        if (hoveredRouteID && hoveredRouteID === currentHoveredRouteID) return;

        if (hoveredRouteID){
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
      map.getCanvas().style.cursor = '';
      if (hoveredRouteID){
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

    // Popover search field
    this._fuse = new Fuse(servicesDataArr, {
      threshold: .3,
      keys: ['number', 'name'],
    });
    this.setState({ services: servicesDataArr });

    this._renderRoute();
  }
  _handleSearchFocus = (e) => {
    this.setState({ expandSearch: true });
    $map.classList.add('fade-out');
    raqScrollTop();
    this._searchPopover.addEventListener('transitionend', (e) => {
      cancelAnimationFrame(raqST);
    });
  }
  _handleSearch = (e) => {
    const { value } = e.target;
    if (value){
      const services = this._fuse.search(value);
      this.setState({ services });
      // Scroll to top, with hack for momentum scrolling
      // https://popmotion.io/blog/20170704-manually-set-scroll-while-ios-momentum-scroll-bounces/
      this._servicesList.style['-webkit-overflow-scrolling'] = 'auto';
      this._servicesList.scrollTop = 0;
      this._servicesList.style['-webkit-overflow-scrolling'] = null;
    } else {
      this.setState({ services: this.state.servicesDataArr });
    }
  }
  _handleSearchClose = () => {
    this.setState({ expandSearch: false });
    $map.classList.remove('fade-out');
    this._resetSearch();
  }
  _resetSearch = () => {
    this._searchField.value = '';
    this.setState({ services: this.state.servicesDataArr });
  }
  _handleServicesScroll = () => {
    this.setState({
      expandSearch: true,
    });
  }
  _showStopPopover = (stop) => {
    const map = this.map;
    const { geometry } = stop;

    const zoom = map.getZoom();
    const center = geometry.coordinates;
    if (zoom < 12){
      // Slowly zoom in first
      map.flyTo({ zoom: map.getZoom() + 2, center });
      this.setState({
        shrinkSearch: true,
      });
      return;
    }

    map.getSource('stop-selected').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry,
        },
      ],
    });

    const { stopsData, route } = this.state;
    const currentService = route.value;
    const { number, name } = stop.properties;
    const { services } = stopsData[number];
    this.setState({
      shrinkSearch: true,
      showStopPopover: {
        currentService,
        number,
        name,
        services,
      },
    }, () => {
      const offset = BREAKPOINT() ? [0, 0] : [0, -this._stopPopover.offsetHeight/2];
      if (zoom < 15){
        map.flyTo({ zoom: 15, center, offset });
      } else {
        map.easeTo({ center, offset });
      }
    });
  }
  _hideStopPopover = (e) => {
    e.preventDefault();
    this.setState({
      showStopPopover: false,
    });
    this.map.getSource('stop-selected').setData({
      type: 'FeatureCollection',
      features: [],
    });
  }
  _highlightRouteTag = (service) => {
    const $servicesList = this._floatPill.querySelector('.services-list');
    if (!$servicesList) return;
    if (service){
      const otherServices = $servicesList.querySelectorAll('.service-tag');
      otherServices.forEach(el => {
        if (el.textContent.trim() === service.trim()){
          el.style.opacity = '';
        } else {
          el.style.opacity = .3;
        }
      });
    } else {
      $servicesList.querySelectorAll('.service-tag').forEach(el => el.style.opacity = '');
    }
  }
  _highlightRoute = (service) => {
    const hoveredRouteID = encode(service);
    this.map.setFeatureState({
      source: 'routes-path',
      id: hoveredRouteID,
    }, { hover: true, fadein: false });

    STORE.routesPathServices.forEach(service => {
      const id = encode(service);
      if (hoveredRouteID === id) return;
      this.map.setFeatureState({
        source: 'routes-path',
        id,
      }, { hover: false, fadein: true });
    });
  }
  _unhighlightRoute = () => {
    STORE.routesPathServices.forEach(service => {
      const id = encode(service);
      this.map.setFeatureState({
        source: 'routes-path',
        id,
      }, { fadein: false, hover: false });
    });
  }
  _openBusArrival = (e) => {
    e.preventDefault();
    const width = 360;
		const height = 480;
		const top = ((screen.availHeight || screen.height) - height) / 2;
    const left = (screen.width - width) / 2;
		window.open(e.target.href, 'busArrivals'+(new Date()), `width=${width},height=${height},menubar=0,toolbar=0,top=${top},left=${left}`);
  }
  _renderRoute = () => {
    const { servicesData, stopsData, routesData, route } = this.state;
    const map = this.map;
    console.log('Route', route);

    // Reset everything
    $map.classList.remove('fade-out');
    this.setState({
      showStopPopover: false,
    });
    [
      'stops-highlight',
      'stop-selected',
      'routes',
      'routes-path',
    ].forEach(source => {
      map.getSource(source).setData({
        type: 'FeatureCollection',
        features: [],
      });
    });

    switch (route.page){
      case 'service': {
        // Reset
        this.setState({
          expandSearch: false,
          shrinkSearch: true,
        });
        this._resetSearch();

        // Hide all stops
        map.setLayoutProperty('stops', 'visibility', 'none');

        // Show stops of the selected service
        const service = route.value;
        const { routes } = servicesData[service];
        const endStops = [routes[0][0], routes[0][routes[0].length-1]];
        if (routes[1]) endStops.push(routes[1][0], routes[1][routes[1].length-1]);
        let routeStops = [...routes[0], ...(routes[1] || [])].filter((el, pos, arr) => {
          return arr.indexOf(el) == pos;
        }); // Merge and unique
        map.getSource('stops-highlight').setData({
          type: 'FeatureCollection',
          features: routeStops.map((stop, i) => ({
            type: 'Feature',
            id: encode(stop),
            properties: {
              name: stopsData[stop].name,
              number: stop,
              type: endStops.includes(stop) ? 'end' : null,
            },
            geometry: {
              type: 'Point',
              coordinates: stopsData[stop].coordinates,
            },
          })),
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
          padding: BREAKPOINT() ? 40 : {
            top: 40,
            right: 40,
            bottom: 60 + 54 + 40, // height of search bar + float pill
            left: 40,
          },
        });

        break;
      }
      case 'stop': {
        // Reset
        this.setState({
          expandSearch: false,
          shrinkSearch: true,
        });

        // Hide all stops
        map.setLayoutProperty('stops', 'visibility', 'none');

        // Show the all stops in all routes
        const allStopsCoords = [];
        const stop = route.value;
        const { routes, name, coordinates } = stopsData[stop];
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
        const bottom = this._floatPill ? (this._floatPill.offsetHeight + 60 + 40) : 40;
        map.fitBounds(bounds, {
          padding: BREAKPOINT() ? 40 : {
            top: 40,
            right: 40,
            bottom,
            left: 40,
          },
        });
        break;
      }
      default: {
        // Show all stops
        map.setLayoutProperty('stops', 'visibility', 'visible');
      }
    }
  }
  componentDidUpdate(_, prevState){
    const { route } = this.state;
    if (route.path != prevState.route.path){
      this._renderRoute();
    }
  }
  render(_, state){
    const {
      route,
      services,
      expandSearch,
      servicesData,
      stopsData,
      shrinkSearch,
      showStopPopover,
    } = state;

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
                    <p>{servicesData[route.value].routes.length} route{servicesData[route.value].routes.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            ) : route.page === 'stop' && stopsData && (
              <div class="float-pill" ref={c => this._floatPill = c}>
                <a href="#/" class="popover-close">&times;</a>
                <div class="service-flex">
                  <span class="stop-tag">{route.value}</span>
                  <div>
                    <h1>{stopsData[route.value].name}</h1>
                    <p>{stopsData[route.value].services.length} service{stopsData[route.value].routes.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div class="services-list">
                  {stopsData[route.value].services.sort(sortServices).map(service => (
                    <a
                      href={`#/services/${service}`}
                      onMouseEnter={() => this._highlightRoute(service)}
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
              placeholder="Search for bus service"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              ref={c => this._searchField = c}
              onfocus={this._handleSearchFocus}
              oninput={this._handleSearch}
            />
            <button type="button" onclick={this._handleSearchClose}>Cancel</button>
          </div>
          <ul id="services-list" class={`popover-list ${services.length ? '' : 'loading'}`} ref={c => this._servicesList = c} onScroll={this._handleServicesScroll}>
            {services.length ? (
              services.map(s => (
                <li key={s.number}>
                  <a href={`#/services/${s.number}`}>
                    <b class="service-tag">{s.number}</b> {s.name}
                  </a>
                </li>
              ))
            ) : (
              [1,2,3,4,5,6,7,8].map((s, i) => (
                <li key={s}>
                  <a href="#">
                    <b class="service-tag">&nbsp;&nbsp;&nbsp;</b>
                    <span class="placeholder">█████{i % 3 == 0 ? '███' : ''} ███{i % 2 == 0 ? '████' : ''}</span>
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
        <div id="stop-popover" ref={c => this._stopPopover = c} class={`popover ${showStopPopover ? 'expand' : ''}`}>
          {showStopPopover && [
            <a href="#/" onClick={this._hideStopPopover} class="popover-close">&times;</a>,
            <header>
              <h1><b class="stop-tag">{showStopPopover.number}</b> {showStopPopover.name}</h1>
              <h2>{showStopPopover.services.length} service{showStopPopover.services.length == 1 ? '' : 's'}</h2>
            </header>,
            <div class="popover-scroll">
              <BusServicesArrival id={showStopPopover.number} services={showStopPopover.services}/>
              <div class="popover-buttons">
                <a href={`/bus-arrival/#${showStopPopover.number}`} target="_blank" onClick={this._openBusArrival} class="popover-button">Bus arrivals <img src={openNewWindowImagePath} width="16" height="16" alt=""/></a>
                <a href={`#/stops/${showStopPopover.number}`} class="popover-button">Passing routes <img src={passingRoutesImagePath} width="16" height="16" alt=""/></a>
              </div>
            </div>
          ]}
        </div>
      </div>
    );
  }
}

render(<App />, document.getElementById('app'));
