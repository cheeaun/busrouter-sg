import './i18n';
import './error-tracking';

import { h, render, Fragment } from 'preact';
import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { toGeoJSON } from '@mapbox/polyline';
import Fuse from 'fuse.js';
import intersect from 'just-intersect';
import CheapRuler from 'cheap-ruler';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
import { useTranslation } from 'react-i18next';

import { MAPBOX_ACCESS_TOKEN } from './config';
import { encode, decode } from './utils/specialID';
import { sortServices } from './utils/bus';
import fetchCache from './utils/fetchCache';
import getRoute from './utils/getRoute';
import getDistance from './utils/getDistance';
import getWalkingMinutes from './utils/getWalkingMinutes';
import usePrevious from './utils/usePrevious';
import { findLoopHalfpoint } from './utils/routesCalculation';

import Ad from './ad';
import About from './components/About';
import BusServicesArrival from './components/BusServicesArrival';
import GeolocateControl from './components/GeolocateControl';
import BetweenRoutes from './components/BetweenRoutes';
import ScrollableContainer from './components/ScrollableContainer';
import StopsList from './components/StopsList.jsx';

import stopImagePath from './images/stop.png';
import stopEndImagePath from './images/stop-end.png';
import openNewWindowImagePath from './images/open-new-window.svg';
import openNewWindowBlueImagePath from './images/open-new-window-blue.svg';
import passingRoutesBlueImagePath from './images/passing-routes-blue.svg';
import iconSVGPath from '../icons/icon.svg';
import busTinyImagePath from './images/bus-tiny.png';

const dataPath = 'https://data.busrouter.sg/v1/';
const routesJSONPath = dataPath + 'routes.min.json';
const stopsJSONPath = dataPath + 'stops.min.json';
const servicesJSONPath = dataPath + 'services.min.json';

const $map = document.getElementById('map');
const STORE = {};
const BREAKPOINT = () => window.innerWidth > 640;
const supportsHover =
  window.matchMedia && matchMedia('(any-hover: hover)').matches;
const supportsTouch =
  (window.matchMedia && matchMedia('(any-pointer: coarse)').matches) ||
  'ontouchstart' in window ||
  navigator.MaxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;
const supportsPromise = 'Promise' in window;
const ruler = new CheapRuler(1.3);

const $logo = document.getElementById('logo');

const redirectToOldSite = () => {
  const redirect = confirm(
    'Looks like your browser is a little old. Redirecting you to the older version of BusRouter SG.',
  );
  if (redirect) location.href = 'https://v1.busrouter.sg/';
};

if (!supportsPromise || !mapboxgl.supported()) {
  redirectToOldSite();
}

let rafST;
const rafScrollTop = () => {
  window.scrollTo(0, 0);
  rafST = requestAnimationFrame(rafScrollTop);
};

const $tooltip = document.getElementById('tooltip');
function showStopTooltip(data) {
  $tooltip.innerHTML = `<span class="stop-tag">${data.number}</span> ${data.name}`;
  $tooltip.classList.add('show');
  const { x, y: top } = data;
  const left = Math.max(
    5 + $map.offsetLeft,
    Math.min(
      window.innerWidth - $tooltip.offsetWidth - 5,
      x + $map.offsetLeft - 5,
    ),
  );
  $tooltip.style.transform = `translate(${left}px, ${top}px)`;
}
function hideStopTooltip() {
  $tooltip.classList.remove('show');
}

window.requestIdleCallback =
  window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
const lowerLat = 1.2,
  upperLat = 1.48,
  lowerLong = 103.59,
  upperLong = 104.05;
const CACHE_TIME = 24 * 60; // 1 day
let map;
let servicesDataArr = [];
let stopsDataArr = [];
let servicesData;
let stopsData = {};
let routesData;
let fuseServices;
let fuseStops;

const App = () => {
  const { t, i18n } = useTranslation();

  const [route, setRoute] = useState(getRoute());
  const prevRoute = usePrevious(route);

  const [routeLoading, setRouteLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [stops, setStops] = useState([]);
  const [searching, setSearching] = useState(false);
  const [expandSearch, setExpandSearch] = useState(false);
  const [expandedSearchOnce, setExpandedSearchOnce] = useState(false);
  const [shrinkSearch, setShrinkSearch] = useState(false);
  const [stopPopoverData, setStopPopoverData] = useState(null);
  const [showStopPopover, setShowStopPopover] = useState(false);
  const [showServicePopover, setShowServicePopover] = useState(false);
  const [showArrivalsPopover, setShowArrivalsPopover] = useState(false);
  const [intersectStops, setIntersectStops] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [routeServices, setRouteServices] = useState([]);

  const [showBetweenPopover, setShowBetweenPopover] = useState(false);
  const [betweenStartStop, setBetweenStartStop] = useState(null);
  const [betweenEndStop, setBetweenEndStop] = useState(null);

  const prevStopNumber = useRef(null);
  const servicesList = useRef(null);
  const searchField = useRef(null);
  const searchPopover = useRef(null);
  const stopPopover = useRef(null);
  const floatPill = useRef(null);
  const betweenPopover = useRef(null);
  const servicePopover = useRef(null);

  let previewRAF = useRef(null).current;

  // let labelLayerId;

  const largerScreen = window.matchMedia(
    '(min-width: 1200px) and (min-height: 600px) and (orientation: landscape)',
  ).matches;

  const handleKeys = (e) => {
    switch (e.key.toLowerCase()) {
      case 'enter': {
        const link = servicesList.current?.querySelector('li a[href^="#"]');
        if (link) {
          searchField.current?.blur();
          link.click();
        }
        break;
      }
    }
  };

  const handleSearchFocus = (e) => {
    setExpandSearch(true);
    setExpandedSearchOnce(true);
    // $map.classList.add('fade-out');
    rafScrollTop();
    searchPopover.current?.addEventListener('transitionend', (e) => {
      cancelAnimationFrame(rafST);
    });
  };

  const handleSearch = (e) => {
    const { value } = (e && e.target) || searchField;
    if (value) {
      const services = fuseServices.search(value);
      let stops = [];
      if (services.length < 20) {
        stops = fuseStops.search(value);
      }
      setServices(services.map((s) => s.item));
      setStops(stops.map((s) => s.item));
      setSearching(true);
      // Scroll to top, with hack for momentum scrolling
      // https://popmotion.io/blog/20170704-manually-set-scroll-while-ios-momentum-scroll-bounces/
      servicesList.current.style['-webkit-overflow-scrolling'] = 'auto';
      servicesList.current.scrollTop = 0;
      servicesList.current.style['-webkit-overflow-scrolling'] = null;
    } else {
      setServices(servicesDataArr);
      setStops([]);
      setSearching(false);
    }
  };

  const handleSearchClose = () => {
    setExpandSearch(false);
    $map.classList.remove('fade-out');
    resetSearch();
  };

  const resetSearch = () => {
    searchField.current?.blur();
    searchField.current.value = '';
    setSearching(false);
    setServices(servicesDataArr);
    setStops([]);
  };

  const handleServicesScroll = () => {
    if (expandSearch) return;
    setExpandSearch(true);
    setExpandedSearchOnce(true);
    // $map.classList.add('fade-out');
  };

  const _showStopPopover = (number) => {
    const { services, coordinates, name } = stopsData[number];

    const popoverHeight = stopPopover.current?.offsetHeight;
    const offset = BREAKPOINT() ? [0, 0] : [0, -popoverHeight / 2];
    const zoom = map.getZoom();
    if (zoom < 17) {
      map.flyTo({
        zoom: 17,
        center: coordinates,
        offset,
        animate: zoom >= 12,
      });
    } else {
      map.easeTo({ center: coordinates, offset });
    }

    if (prevStopNumber.current) {
      map.setFeatureState(
        {
          source: 'stops',
          id: encode(prevStopNumber.current),
        },
        {
          selected: false,
        },
      );
      map.setFeatureState(
        {
          source: 'stops-highlight',
          id: encode(prevStopNumber.current),
        },
        {
          selected: false,
        },
      );
    }
    map.setFeatureState(
      {
        source: 'stops',
        id: encode(number),
      },
      {
        selected: true,
      },
    );
    map.setFeatureState(
      {
        source: 'stops-highlight',
        id: encode(number),
      },
      {
        selected: true,
      },
    );

    setShrinkSearch(true);
    prevStopNumber.current = number;
    setShowStopPopover(true);
    setStopPopoverData({ number, name, services });

    requestAnimationFrame(() => {
      if (popoverHeight === stopPopover.current?.offsetHeight) return;
      const offset = BREAKPOINT()
        ? [0, 0]
        : [0, -stopPopover.current?.offsetHeight / 2];
      const zoom = map.getZoom();
      if (zoom < 17) {
        map.flyTo({
          zoom: 17,
          center: coordinates,
          offset,
          animate: zoom >= 12,
        });
      } else {
        map.easeTo({ center: coordinates, offset });
      }
    });
  };

  const hideStopPopover = (e) => {
    const { page, subpage } = route;
    if (e && (page !== 'stop' || subpage === 'routes')) {
      e.preventDefault();
    }
    const number = stopPopoverData?.number || prevStopNumber.current;
    let stopToBeHighlighted;
    if (number) {
      map.setFeatureState(
        {
          source: 'stops',
          id: encode(number),
        },
        {
          selected: false,
        },
      );
      map.setFeatureState(
        {
          source: 'stops-highlight',
          id: encode(number),
        },
        {
          selected: false,
        },
      );
      if (stopPopover.current?.classList.contains('expand')) {
        requestAnimationFrame(() => {
          stopToBeHighlighted = servicePopover.current?.querySelector(
            `a[data-stop="${number}"]`,
          );
          stopToBeHighlighted?.classList.add('flash');
          stopToBeHighlighted?.scrollIntoView({
            behaviour: 'smooth',
            block: 'center',
            inline: 'center',
          });
        });
      }
    }
    setShowStopPopover(false);
    prevStopNumber.current = null;
    setTimeout(() => {
      stopToBeHighlighted?.classList.remove('flash');
    }, 1000);
  };

  const navBackToStop = (e) => {
    if (prevRoute?.page === 'stop') {
      e.preventDefault();
      history.back();
    }
  };

  const zoomToStop = (num) => {
    const number = num || stopPopoverData?.number;
    const { coordinates } = stopsData[number];
    let offset = BREAKPOINT()
      ? [0, 0]
      : [0, -stopPopover.current.offsetHeight / 2];
    if (showServicePopover) {
      offset = BREAKPOINT()
        ? [-servicePopover.current.offsetWidth / 3, 0]
        : [0, -servicePopover.current.offsetHeight / 2];
    }
    const zoom = map.getZoom();
    if (zoom < 17) {
      map.flyTo({
        zoom: 17,
        center: coordinates,
        offset,
      });
    } else {
      map.easeTo({ center: coordinates, offset });
    }
  };

  const highlightRouteTag = (service) => {
    const $servicesList = floatPill.current?.querySelector('.services-list');
    if (!$servicesList) return;
    if (service) {
      const otherServices = $servicesList.querySelectorAll('.service-tag');
      otherServices.forEach((el) => {
        el.classList.remove('highlight');
        if (el.dataset.service.trim() === service.trim()) {
          el.style.opacity = '';
        } else {
          el.style.opacity = 0.3;
        }
      });
    } else {
      $servicesList
        .querySelectorAll('.service-tag')
        .forEach((el) => (el.style.opacity = ''));
    }
  };

  const clickRoute = (e, service) => {
    const { target } = e;
    e.stopPropagation();
    if (target.classList.contains('highlight')) return;
    e.preventDefault();
    target.classList.add('highlight');
    highlightRoute(null, service, true);
  };

  const highlightRoute = (e, service, zoomIn) => {
    if (e) e.target.classList.remove('highlight');
    const hoveredRouteID = encode(service);
    map.setFeatureState(
      {
        source: 'routes-path',
        id: hoveredRouteID,
      },
      { hover: true, fadein: false },
    );

    STORE.routesPathServices?.forEach((service) => {
      const id = encode(service);
      if (hoveredRouteID === id) return;
      map.setFeatureState(
        {
          source: 'routes-path',
          id,
        },
        { hover: false, fadein: true },
      );
    });

    if (zoomIn) {
      // Fit map to route bounds
      requestAnimationFrame(() => {
        const { routes } = servicesData[service];
        const coordinates = routes[0]
          .concat(routes[1] || [])
          .map((stop) => stopsData[stop].coordinates);
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((c) => {
          bounds.extend(c);
        });
        map.fitBounds(bounds, {
          padding: largerScreen
            ? {
                top: floatPill.current.offsetHeight / 2,
                right: 80,
                bottom: 80,
                left: floatPill.current.offsetHeight / 2,
              }
            : BREAKPOINT()
            ? {
                top: 80,
                right: Math.max(floatPill.current.offsetWidth / 2, 80),
                bottom: 60 + 20 + floatPill.current.offsetHeight / 2,
                left: Math.max(floatPill.current.offsetWidth / 2, 80),
              }
            : {
                top: 80,
                right: 80,
                bottom: 60 + 20 + floatPill.current.offsetHeight, // height of search bar + float pill
                left: 80,
              },
        });
      });
    }
  };

  const unhighlightRoute = (e) => {
    if (e && e.target?.classList.contains('service-tag')) {
      e.target.classList.remove('highlight');
    }
    STORE.routesPathServices?.forEach((service) => {
      const id = encode(service);
      map.setFeatureState(
        {
          source: 'routes-path',
          id,
        },
        { fadein: false, hover: false },
      );
    });
  };

  const openBusArrival = (e, showPopup = false) => {
    if (e) e.preventDefault();
    const width = 360;
    const height = 480;
    const url = e.target.href;
    const stopNumber = url.match(/[^#]+$/)[0];
    showPopup =
      showPopup ||
      (window.innerWidth > width * 2 && window.innerHeight > height) ||
      window.innerWidth > window.innerHeight; // landscape is weird
    if (showPopup) {
      const top = ((screen.availHeight || screen.height) - height) / 2;
      const left = (screen.width - width) / 2;
      window.open(
        url,
        `busArrivals-${stopNumber}`,
        `width=${width},height=${height},menubar=0,toolbar=0,top=${top},left=${left}`,
      );
    } else {
      setShowArrivalsPopover({
        webviewURL: url,
        number: stopNumber,
      });
      $map.classList.add('fade-out');
    }
  };

  const closeBusArrival = (e) => {
    if (e) e.preventDefault();
    setShowArrivalsPopover(false);
    $map.classList.remove('fade-out');
  };

  const _showBetweenPopover = (data) => {
    setShrinkSearch(true);
    setShowBetweenPopover(data);

    // Auto-select first result
    setTimeout(() => {
      const firstResult = betweenPopover.current.querySelector('.between-item');
      firstResult.click();
    }, 300);
  };

  const cannotPreviewRoute = () => {
    const { page, subpage, value } = route;
    return (
      subpage === 'routes' ||
      (page === 'service' && value.split('~').length > 1)
    );
  };

  const previewRoute = (service) => {
    cancelAnimationFrame(previewRAF);
    if (cannotPreviewRoute()) return;
    previewRAF = requestAnimationFrame(() => {
      const routes = routesData[service];
      const geometries = routes.map((route) => toGeoJSON(route));
      map.getSource('routes-path').setData({
        type: 'FeatureCollection',
        features: geometries.map((geometry) => ({
          type: 'Feature',
          id: encode(service),
          properties: {
            service,
          },
          geometry,
        })),
      });
    });
  };

  const unpreviewRoute = () => {
    cancelAnimationFrame(previewRAF);
    if (cannotPreviewRoute()) return;
    map.getSource('routes-path').setData({
      type: 'FeatureCollection',
      features: [],
    });
  };

  const renderBetweenRoute = ({ e, startStop, endStop, result }) => {
    const { target } = e;
    target.parentElement.parentElement
      .querySelectorAll('.between-item')
      .forEach((el) => {
        if (el === target) {
          target.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });

    const stops = [
      { ...startStop, end: true },
      { ...endStop, end: true },
    ];
    if (result.startStop && result.startStop.number != startStop.number) {
      stops.push({ ...result.startStop, end: true });
    }
    if (result.endStop && result.endStop.number != endStop.number) {
      stops.push({ ...result.endStop, end: true });
    }
    if (result.stopsBetween.length) {
      result.stopsBetween.forEach((number) => stops.push(stopsData[number]));
    }

    // Render stops
    map.getSource('stops-highlight').setData({
      type: 'FeatureCollection',
      features: stops.map((stop) => ({
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
      }
      if (result.endStop && result.endStop.number != endStop.number) {
        geometries.push({
          type: 'LineString',
          coordinates: [result.endStop.coordinates, endStop.coordinates],
        });
      }
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
      stops.forEach((stop) => {
        bounds.extend(stop.coordinates);
      });
      map.fitBounds(bounds, {
        padding: BREAKPOINT()
          ? {
              top: 80,
              right: betweenPopover.current.offsetWidth + 80,
              bottom: 80,
              left: 80,
            }
          : {
              top: 80,
              right: 80,
              bottom: betweenPopover.current.offsetHeight + 80,
              left: 80,
            },
      });
    });
  };

  const defaultURL = document.querySelector('meta[property="og:url"]').content;
  const defaultImg = document.querySelector(
    'meta[property="og:image"]',
  ).content;
  const defaultHead = {
    title: ['app.title'],
    url: defaultURL,
    desc: ['app.description'],
    image: defaultImg,
  };
  const [head, setHead] = useState(defaultHead);
  useEffect(() => {
    let { title, url, desc, image } = head;
    document.title = document.querySelector(
      'meta[property="og:title"]',
    ).content = Array.isArray(title) ? t(...title) : title;
    if (!/^https?/.test(url)) url = 'https://busrouter.sg/#' + url;
    document.querySelector('meta[property="og:url"]').content = url;
    document.querySelector('meta[name="description"]').content =
      document.querySelector('meta[property="og:description"]').content =
        Array.isArray(desc) ? t(...desc) : desc;
    document.querySelector('meta[property="og:image"]').content = image;
  }, [head]);

  useEffect(() => {
    i18n.on('languageChanged', () => {
      setHead({ ...head });
    });
  }, []);

  const renderRoute = () => {
    const route = getRoute();

    // Reset everything
    $map.classList.remove('fade-out');
    setShowStopPopover(false);
    setShowServicePopover(false);
    setShowBetweenPopover(false);
    [
      'stops-highlight',
      'routes',
      'routes-path',
      'routes-between',
      'buses-service',
    ].forEach((source) => {
      map.getSource(source)?.setData({
        type: 'FeatureCollection',
        features: [],
      });
    });
    if (prevStopNumber.current) {
      hideStopPopover();
    }

    map.setLayoutProperty(
      'traffic',
      'visibility',
      route.page === 'stop' && route.subpage !== 'routes' ? 'visible' : 'none',
    );

    switch (route.page) {
      case 'service': {
        const servicesValue = route.value;
        const services = servicesValue
          .split('~')
          .filter((s) => servicesData[s]);
        if (!services.length) return; // No value or none of the service codes are valid

        // Reset
        setExpandSearch(false);
        setShrinkSearch(true);
        resetSearch();

        // Hide all stops
        map.setLayoutProperty('stops', 'visibility', 'none');
        map.setLayoutProperty('stops-icon', 'visibility', 'none');

        setRouteServices(services);

        if (services.length === 1) {
          const service = services[0];
          const { name, routes } = servicesData[service];
          setHead({
            title: [
              'service.title',
              {
                serviceNumber: service,
                serviceName: name,
              },
            ],
            url: `/services/${service}`,
          });

          setShowServicePopover(true);

          // Show stops of the selected service
          const endStops = [routes[0][0], routes[0][routes[0].length - 1]];
          if (routes[1])
            endStops.push(routes[1][0], routes[1][routes[1].length - 1]);
          let routeStops = [...routes[0], ...(routes[1] || [])].filter(
            (el, pos, arr) => arr.indexOf(el) == pos,
          ); // Merge and unique

          // Fit map to route bounds
          const bounds = new mapboxgl.LngLatBounds();
          routeStops.forEach((stop) => {
            const { coordinates } = stopsData[stop];
            bounds.extend(coordinates);
          });
          requestAnimationFrame(() => {
            map.fitBounds(bounds, {
              padding: BREAKPOINT()
                ? {
                    top: 80,
                    right: servicePopover.current.offsetWidth + 80,
                    bottom: 80,
                    left: 80,
                  }
                : {
                    top: 80,
                    right: 80,
                    bottom: servicePopover.current.offsetHeight + 20,
                    left: 80,
                  },
            });
          });

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
            const { name: serviceName, routes: serviceStops } =
              servicesData[service];
            const isLoop = serviceName.includes('⟲');

            const routes = routesData[service];
            const geometries = routes.map((route) => toGeoJSON(route));

            if (isLoop) {
              const loopStops = serviceStops[0];
              const loopGeometries = geometries[0];

              const [half, hasMidStop] = findLoopHalfpoint(
                loopStops,
                loopStops.length,
              );

              let midStopCoordinate;
              if (hasMidStop) {
                const midStop = loopStops[half];

                midStopCoordinate = stopsData[midStop].coordinates;
              } else {
                const lastStopOfFirstHalfOfLoop = loopStops[half - 1];
                const firstStopOfSecondHalfOfLoop = loopStops[half];

                const lastStopFirstHalfCoordinates =
                  stopsData[lastStopOfFirstHalfOfLoop].coordinates;
                const firstStopSecondHalfCoordinates =
                  stopsData[firstStopOfSecondHalfOfLoop].coordinates;

                const middleSegment = ruler.lineSlice(
                  lastStopFirstHalfCoordinates,
                  firstStopSecondHalfCoordinates,
                  loopGeometries.coordinates,
                );

                const middleSegmentLength = ruler.lineDistance(middleSegment);

                midStopCoordinate = ruler.along(
                  middleSegment,
                  middleSegmentLength / 2,
                );
              }

              const {
                point: interpolatedCoordinate,
                index: interpolationSegmentIndex,
              } = ruler.pointOnLine(
                loopGeometries.coordinates,
                midStopCoordinate,
              );

              const newGeometries = [loopGeometries, loopGeometries];
              const splittedNewGeometries = newGeometries.map(
                ({ type, coordinates }, index) =>
                  !index
                    ? {
                        type,
                        coordinates: [
                          ...coordinates.slice(
                            0,
                            interpolationSegmentIndex + 1,
                          ),
                          interpolatedCoordinate,
                        ],
                      }
                    : {
                        type,
                        coordinates: [
                          interpolatedCoordinate,
                          ...coordinates.slice(interpolationSegmentIndex + 1),
                        ],
                      },
              );

              map.getSource('routes').setData({
                type: 'FeatureCollection',
                features: splittedNewGeometries.map((geometry, direction) => ({
                  type: 'Feature',
                  properties: {
                    direction,
                  },
                  geometry,
                })),
              });
            } else {
              map.getSource('routes').setData({
                type: 'FeatureCollection',
                features: geometries.map((geometry, direction) => ({
                  type: 'Feature',
                  properties: {
                    direction,
                  },
                  geometry,
                })),
              });
            }
          });
        } else {
          const serviceNumbersNames = services
            .map((s) => {
              const { name } = servicesData[s];
              return `${s}: ${name}`;
            })
            .join(', ');
          setHead({
            title: ['service.title', { serviceNumbersNames }],
            url: `/services/${services.join('~')}`,
          });

          let routeStops = [];
          let endStops = [];
          let serviceGeometries = [];
          services.forEach((service) => {
            const { routes } = servicesData[service];
            endStops.push(routes[0][0], routes[0][routes[0].length - 1]);
            if (routes[1]) {
              endStops.push(routes[1][0], routes[1][routes[1].length - 1]);
            }
            const allRoutes = [...routes[0], ...(routes[1] || [])].filter(
              (el, pos, arr) => {
                return arr.indexOf(el) === pos;
              },
            );
            routeStops = routeStops.concat(allRoutes);

            const routeGeometries = routesData[service];
            serviceGeometries = serviceGeometries.concat(
              routeGeometries.map((r) => ({
                service,
                geometry: toGeoJSON(r),
              })),
            );
          });

          // Merge and unique stops
          const intersectStops = [];
          routeStops = routeStops.filter((el, pos, arr) => {
            const unique = arr.indexOf(el) === pos;
            if (!unique && !intersectStops.includes(el))
              intersectStops.push(el);
            return unique;
          });
          intersectStops.sort();
          setIntersectStops(intersectStops);

          // Fit map to route bounds
          const bounds = new mapboxgl.LngLatBounds();
          routeStops.forEach((stop) => {
            const { coordinates } = stopsData[stop];
            bounds.extend(coordinates);
          });
          requestAnimationFrame(() => {
            map.fitBounds(bounds, {
              padding: largerScreen
                ? {
                    top: floatPill.current.offsetHeight / 2,
                    right: 80,
                    bottom: 80,
                    left: floatPill.current.offsetHeight / 2,
                  }
                : BREAKPOINT()
                ? {
                    top: 80,
                    right: Math.max(floatPill.current.offsetWidth / 2, 80),
                    bottom: 60 + 20 + floatPill.current.offsetHeight / 2,
                    left: Math.max(floatPill.current.offsetWidth / 2, 80),
                  }
                : {
                    top: 80,
                    right: 80,
                    bottom: 60 + 20 + floatPill.current.offsetHeight, // height of search bar + float pill
                    left: 80,
                  },
            });
          });

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
                  type: endStops.includes(stop)
                    ? 'end'
                    : intersectStops.includes(stop)
                    ? 'intersect'
                    : null,
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
            map.getSource('routes-path').setData({
              type: 'FeatureCollection',
              features: serviceGeometries.map((sg) => ({
                type: 'Feature',
                id: encode(sg.service),
                properties: {
                  service: sg.service,
                },
                geometry: sg.geometry,
              })),
            });
            STORE.routesPathServices = serviceGeometries.map(
              (sg) => sg.service,
            );
          });
        }

        break;
      }
      case 'stop': {
        const stop = route.value;
        if (!stopsData[stop]) return;

        // Reset
        setExpandSearch(false);
        setShrinkSearch(true);
        resetSearch();

        const { routes, name, coordinates } = stopsData[stop];
        if (route.subpage === 'routes') {
          setHead({
            title: ['stop.titleRoutes', { stopNumber: stop, stopName: name }],
            url: `/stops/${stop}/routes`,
          });

          // Hide all stops
          map.setLayoutProperty('stops', 'visibility', 'none');
          map.setLayoutProperty('stops-icon', 'visibility', 'none');

          // Show the all stops in all routes
          const allStopsCoords = [];
          allStopsCoords.push(coordinates);
          const otherStops = new Set();
          routes.forEach((route) => {
            const [service, index] = route.split('-');
            const stops = servicesData[service].routes[index];
            stops.forEach((s) => stop !== s && otherStops.add(s));
          });
          [...otherStops].map((s) => {
            allStopsCoords.push(stopsData[s].coordinates);
          });

          // Fit map to route bounds
          const bounds = new mapboxgl.LngLatBounds();
          allStopsCoords.forEach((coordinates) => {
            bounds.extend(coordinates);
          });
          requestAnimationFrame(() => {
            map.fitBounds(bounds, {
              padding: largerScreen
                ? {
                    top: floatPill.current.offsetHeight / 2,
                    right: 80,
                    bottom: 80,
                    left: floatPill.current.offsetHeight / 2,
                  }
                : BREAKPOINT()
                ? {
                    top: 80,
                    right: Math.max(floatPill.current.offsetWidth / 2, 80),
                    bottom: 60 + 20 + floatPill.current.offsetHeight / 2,
                    left: Math.max(floatPill.current.offsetWidth / 2, 80),
                  }
                : {
                    top: 80,
                    right: 80,
                    bottom: 60 + 20 + floatPill.current.offsetHeight, // height of search bar + float pill
                    left: 80,
                  },
            });
          });

          map.getSource('stops-highlight').setData({
            type: 'FeatureCollection',
            features: [
              {
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
              },
            ],
          });

          // Show all routes
          requestAnimationFrame(() => {
            const serviceGeometries = routes.map((route) => {
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
            STORE.routesPathServices = serviceGeometries.map(
              (sg) => sg.service,
            );
          });
        } else {
          setHead({
            title: ['stop.title', { stopNumber: stop, stopName: name }],
            url: `/stops/${stop}`,
          });
          map.setLayoutProperty('stops', 'visibility', 'visible');
          map.setLayoutProperty('stops-icon', 'visibility', 'visible');
          _showStopPopover(stop);
        }
        break;
      }
      case 'between': {
        const coords = route.value;
        const [startStopNumber, endStopNumber] = coords
          .split(/[,-]/)
          .map(String);
        if (!stopsData[startStopNumber] || !stopsData[endStopNumber]) {
          alert('One of the stop numbers are not found.');
          return;
        }

        setHead({
          title: `Routes between ${startStopNumber} and ${endStopNumber} - ${t(
            'app.name',
          )}`,
          url: `/between/${startStopNumber}-${endStopNumber}`,
        });
        // Reset
        setExpandSearch(false);
        setShrinkSearch(true);

        // Hide all stops
        map.setLayoutProperty('stops', 'visibility', 'none');
        map.setLayoutProperty('stops-icon', 'visibility', 'none');

        function findRoutesBetween(startStop, endStop) {
          const results = [];

          const endServicesStops = endStop.routes.map((route) => {
            const [service, routeIndex] = route.split('-');
            let serviceStops = servicesData[service].routes[routeIndex];
            serviceStops = serviceStops.slice(
              0,
              serviceStops.indexOf(endStop.number) + 1,
            );
            return { service, stops: serviceStops, route };
          });

          startStop.routes.forEach((route) => {
            const [service, routeIndex] = route.split('-');
            let serviceStops = servicesData[service].routes[routeIndex];
            serviceStops = serviceStops.slice(
              serviceStops.indexOf(startStop.number),
            );

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
        }

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
        }

        const startStop = stopsData[startStopNumber];
        const endStop = stopsData[endStopNumber];
        const nearestEndStop = findNearestStops(endStop);
        const nearestStartStop = findNearestStops(startStop);
        console.log(startStop, endStop, nearestEndStop, nearestStartStop);
        _showBetweenPopover({
          startStop,
          endStop,
          nearestStartStop,
          nearestEndStop,
          startWalkMins: getWalkingMinutes(
            ruler.distance(
              startStop.coordinates,
              nearestStartStop.coordinates,
            ) * 1000,
          ),
          endWalkMins: getWalkingMinutes(
            ruler.distance(endStop.coordinates, nearestEndStop.coordinates) *
              1000,
          ),
          results: [
            findRoutesBetween(startStop, endStop),
            findRoutesBetween(startStop, nearestEndStop),
            findRoutesBetween(nearestStartStop, endStop),
            findRoutesBetween(nearestStartStop, nearestEndStop),
          ],
        });

        break;
      }
      default: {
        setHead(defaultHead);

        // Show all stops
        map.setLayoutProperty('stops', 'visibility', 'visible');
        map.setLayoutProperty('stops-icon', 'visibility', 'visible');
      }
    }

    const { pathname, search, hash } = location;
    gtag('config', window._GA_TRACKING_ID, {
      page_path: pathname + search + hash,
    });

    setRouteLoading(false);
  };

  const setStartStop = (number) => {
    if (betweenEndStop && betweenEndStop != number) {
      location.hash = `/between/${number}-${betweenEndStop}`;
    } else {
      setBetweenStartStop(number);
      setBetweenEndStop(null);
    }
  };

  const setEndStop = (number) => {
    if (betweenStartStop && betweenStartStop != number) {
      location.hash = `/between/${betweenStartStop}-${number}`;
    } else {
      setBetweenStartStop(null);
      setBetweenEndStop(number);
    }
  };

  const resetStartEndStops = () => {
    setBetweenStartStop(null);
    setBetweenEndStop(null);
  };

  const [mapLoaded, setMapLoaded] = useState(false);
  const onLoad = async () => {
    window.onhashchange = () => {
      setRoute(getRoute());
      renderRoute();
    };

    const fetchStopsP = fetchCache(stopsJSONPath, CACHE_TIME);
    const fetchServicesP = fetchCache(servicesJSONPath, CACHE_TIME);
    const fetchRoutesP = fetchCache(routesJSONPath, CACHE_TIME);

    // Init data

    const stops = await fetchStopsP;
    Object.keys(stops).forEach((number) => {
      const stop = stops[number];
      const [lng, lat, name] = stop;
      let left = false;
      if (/[19]$/.test(number)) {
        const oppositeNumber = number.replace(/[19]$/, (d) =>
          d === '1' ? 9 : 1,
        );
        const oppositeStop = stops[oppositeNumber];
        if (oppositeStop) {
          const bearing = ruler.bearing(
            [lng, lat],
            [oppositeStop[0], oppositeStop[1]],
          );
          left = bearing > 0;
        }
      }
      stopsData[number] = {
        name,
        number,
        interchange:
          /\sint$/i.test(name) && !/^(bef|aft|opp|bet)\s/i.test(name),
        coordinates: [lng, lat],
        services: [],
        routes: [],
        left,
      };
      stopsDataArr.push(stopsData[number]);
    });
    stopsDataArr.sort((a, b) => (a.interchange ? 1 : b.interchange ? -1 : 0));

    servicesData = await fetchServicesP;
    Object.keys(servicesData).forEach((number) => {
      const { name, routes } = servicesData[number];
      servicesDataArr.push({
        number,
        name,
      });
      routes.forEach((route, i) => {
        route.forEach((stop) => {
          if (stopsData[stop] && !stopsData[stop].services.includes(number)) {
            stopsData[stop].services.push(number);
            stopsData[stop].routes.push(number + '-' + i);
          }
        });
      });
    });
    servicesDataArr.sort((a, b) => sortServices(a.number, b.number));

    routesData = await fetchRoutesP;

    setServices(servicesDataArr);

    window._data = {
      servicesData,
      stopsData,
      stopsDataArr,
      routesData,
      servicesDataArr,
    };

    map = window._map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/cheeaun/ckn18umqw1jsi17nymmpdinba',
      renderWorldCopies: false,
      boxZoom: false,
      minZoom: 8,
      logoPosition: 'bottom-left',
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: supportsTouch,
      touchPitch: false,
      bounds: [lowerLong, lowerLat, upperLong, upperLat],
      fitBoundsOptions: {
        padding: BREAKPOINT()
          ? 120
          : { top: 40, bottom: window.innerHeight / 2, left: 40, right: 40 },
      },
    });

    if (!supportsTouch) {
      map.touchZoomRotate.disableRotation();
    }

    // Controls
    map.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
      }),
      'bottom-left',
    );
    map.addControl(
      new GeolocateControl({
        offset: () => {
          if (!BREAKPOINT()) {
            if (stopPopover.current?.classList.contains('expand')) {
              return [0, -stopPopover.current.offsetHeight / 2];
            } else if (servicePopover.current?.classList.contains('expand')) {
              return [0, -servicePopover.current.offsetHeight / 2];
            } else if (betweenPopover.current?.classList.contains('expand')) {
              return [0, -betweenPopover.current.offsetHeight / 2];
            }
          }
          return [0, 0];
        },
      }),
      'top-right',
    );

    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: !supportsTouch,
      }),
      'top-right',
    );
    const compassButton = document.querySelector('.mapboxgl-ctrl-compass');
    map.on('rotateend', () => {
      const bearing = map.getBearing();
      compassButton.classList.toggle('show', bearing !== 0);
    });

    const mapLang = () => {
      // There's only en and zh, Don't have ms yet
      return { zh: 'zh-Hans' }[i18n.resolvedLanguage] || i18n.resolvedLanguage;
    };
    const language = new MapboxLanguage({
      supportedLanguages: ['en', 'zh-Hans', 'ms', 'ta', 'ja'],
      defaultLanguage: mapLang(),
    });
    map.addControl(language);

    i18n.on('languageChanged', () => {
      const localizedStyle = language.setLanguage(map.getStyle(), mapLang());
      map.setStyle(localizedStyle);
    });

    let initialMoveStart = false;
    const initialHideSearch = () => {
      if (initialMoveStart) return;
      initialMoveStart = true;
      $logo.classList.add('fadeout');
      setShrinkSearch(true);
    };
    map.once('dragstart', initialHideSearch);
    map.once('zoomstart', initialHideSearch);

    await new Promise((resolve, reject) => {
      map.once('styledata', () => {
        const layers = map.getStyle().layers;
        console.log(layers);

        // labelLayerId = layers.find(
        //   (l) => l.type == 'symbol' && l.layout['text-field'],
        // ).id;

        resolve();
      });
    });

    // const localizedStyle = language.setLanguage(map.getStyle(), 'zh-Hans');
    // map.setStyle(localizedStyle);

    if (window.performance) {
      const timeSincePageLoad = Math.round(performance.now());
      gtag('event', 'timing_complete', {
        name: 'load',
        value: timeSincePageLoad,
        event_category: 'Map',
      });
    }

    map.loadImage(stopImagePath, (e, img) => {
      if (e) throw e;
      map.addImage('stop', img);
    });
    map.loadImage(stopEndImagePath, (e, img) => {
      if (e) throw e;
      map.addImage('stop-end', img);
    });

    setMapLoaded(true);
  };

  useEffect(() => {
    onLoad();
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;
    const mapCanvas = map.getCanvas();

    map.addSource('stops', {
      type: 'geojson',
      tolerance: 10,
      buffer: 0,
      data: {
        type: 'FeatureCollection',
        features: stopsDataArr.map((stop) => ({
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

    const stopTextPartialFormat = ['get', 'number'];
    const stopTextFullFormat = [
      'format',
      ['get', 'number'],
      { 'font-scale': 0.8 },
      '\n',
      {},
      ['get', 'name'],
      { 'text-color': '#000' },
    ];
    const stopText = {
      layout: {
        'text-optional': true,
        'text-field': [
          'step',
          ['zoom'],
          '',
          15,
          stopTextPartialFormat,
          16,
          stopTextFullFormat,
        ],
        'text-size': ['step', ['zoom'], 12, 16, 14],
        'text-justify': [
          'case',
          ['boolean', ['get', 'left'], false],
          'right',
          'left',
        ],
        'text-anchor': [
          'case',
          ['boolean', ['get', 'left'], false],
          'right',
          'left',
        ],
        'text-offset': [
          'case',
          ['boolean', ['get', 'left'], false],
          ['literal', [-1, 0]],
          ['literal', [1, 0]],
        ],
        // 'text-justify': 'auto',
        // 'text-variable-anchor': ['left', 'right'],
        // 'text-radial-offset': 1,
        'text-padding': 0.5,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-max-width': 16,
        'text-line-height': 1.1,
      },
      paint: {
        'text-color': '#f01b48',
        'text-halo-width': 1,
        'text-halo-color': '#fff',
      },
    };

    map.addLayer(
      {
        id: 'stops',
        type: 'circle',
        source: 'stops',
        layout: {
          visibility: 'none',
        },
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              4,
              0.75,
            ],
            14,
            4,
            15,
            ['case', ['boolean', ['feature-state', 'selected'], false], 12, 6],
          ],
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#fff',
            '#f01b48',
          ],
          'circle-stroke-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#f01b48',
            '#fff',
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            5,
            1,
          ],
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1,
            13.9,
            1,
            14,
            0.5,
          ],
          'circle-stroke-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
            13.5,
            1,
            14,
            0.5,
          ],
        },
      },
      'settlement-subdivision-label',
    );

    map.addLayer({
      id: 'stops-icon',
      type: 'symbol',
      source: 'stops',
      filter: ['any', ['>=', ['zoom'], 14], ['get', 'interchange']],
      layout: {
        visibility: 'none',
        // 'symbol-z-order': 'source',
        'icon-image': 'stop',
        'icon-size': ['step', ['zoom'], 0.4, 15, 0.5, 16, 0.6],
        'icon-padding': 0.5,
        'icon-allow-overlap': true,
        // 'icon-ignore-placement': true,
        ...stopText.layout,
      },
      paint: {
        'icon-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          ['case', ['get', 'interchange'], 1, 0],
          14,
          1,
        ],
        ...stopText.paint,
      },
    });

    requestIdleCallback(() => {
      map.on('mouseenter', 'stops', () => {
        mapCanvas.style.cursor = 'pointer';
      });

      let lastFrame = null;
      if (supportsHover) {
        let lastFeature = null;
        map.on('mousemove', (e) => {
          const { point } = e;
          const features = map.queryRenderedFeatures(point, {
            layers: ['stops', 'stops-highlight'],
            validate: false,
          });
          if (features.length && map.getZoom() < 16 && !map.isMoving()) {
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
        if (lastFrame) cancelAnimationFrame(lastFrame);
        requestAnimationFrame(hideStopTooltip);
      });
      map.on('mouseout', hideStopTooltip);
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
      id: 'stops-highlight-circle',
      type: 'circle',
      source: 'stops-highlight',
      minzoom: 11,
      maxzoom: 14,
      filter: [
        'all',
        ['!=', ['get', 'type'], 'end'],
        ['!=', ['get', 'type'], 'intersect'],
      ],
      paint: {
        'circle-radius': ['step', ['zoom'], 1.5, 12, 2],
        'circle-color': '#fff',
        'circle-stroke-color': '#f01b48',
        'circle-stroke-width': ['step', ['zoom'], 1.5, 12, 2],
      },
    });
    map.addLayer({
      id: 'stops-highlight',
      type: 'symbol',
      source: 'stops-highlight',
      filter: [
        'any',
        ['>=', ['zoom'], 14],
        ['==', ['get', 'type'], 'end'],
        ['==', ['get', 'type'], 'intersect'],
      ],
      layout: {
        'icon-image': [
          'case',
          ['==', ['get', 'type'], 'end'],
          'stop-end',
          ['==', ['get', 'type'], 'intersect'],
          'stop-end',
          'stop',
        ],
        'icon-size': [
          'step',
          ['zoom'],
          0.3,
          10,
          [
            'case',
            ['==', ['get', 'type'], 'end'],
            0.3,
            ['==', ['get', 'type'], 'intersect'],
            0.25,
            0.45,
          ],
          15,
          [
            'case',
            ['==', ['get', 'type'], 'end'],
            0.45,
            ['==', ['get', 'type'], 'intersect'],
            0.4,
            0.6,
          ],
        ],
        'icon-anchor': [
          'case',
          ['==', ['get', 'type'], 'end'],
          'bottom',
          ['==', ['get', 'type'], 'intersect'],
          'bottom',
          'center',
        ],
        'icon-padding': 0.5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        ...stopText.layout,
        'text-field': [
          'step',
          ['zoom'],
          ['case', ['==', ['get', 'type'], 'end'], stopTextFullFormat, ''],
          14,
          [
            'case',
            ['==', ['get', 'type'], 'end'],
            stopTextFullFormat,
            stopTextPartialFormat,
          ],
          16,
          stopTextFullFormat,
        ],
        'text-size': [
          'step',
          ['zoom'],
          ['case', ['==', ['get', 'type'], 'end'], 14, 11],
          16,
          14,
        ],
      },
      paint: {
        ...stopText.paint,
        'text-halo-width': ['case', ['==', ['get', 'type'], 'end'], 2, 1],
      },
    });
    map.addLayer(
      {
        id: 'stops-highlight-selected',
        type: 'circle',
        source: 'stops-highlight',
        filter: ['any', ['>', ['zoom'], 10], ['==', ['get', 'type'], 'end']],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            4,
            15,
            [
              'case',
              ['==', ['get', 'type'], 'end'],
              4,
              ['==', ['get', 'type'], 'intersect'],
              4,
              12,
            ],
          ],
          'circle-color': '#fff',
          'circle-stroke-color': '#f01b48',
          'circle-stroke-width': 5,
          'circle-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.5,
            0,
          ],
          'circle-stroke-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.5,
            0,
          ],
        },
      },
      'stops-highlight',
    );

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

    map.addLayer(
      {
        id: 'routes',
        type: 'line',
        source: 'routes',
        layout: {
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'direction'],
            0,
            '#f01b48',
            1,
            '#05A8AA',
            '#000000',
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            0.9,
            16,
            0.4,
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            2,
            16,
            5,
            22,
            10,
          ],
          'line-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            0,
            16,
            -3,
            22,
            ['*', ['zoom'], -3],
          ],
        },
      },
      'stops',
    );

    map.addLayer(
      {
        id: 'routes-bg',
        type: 'line',
        source: 'routes',
        layout: {
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#fff',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 22, 0],
          'line-width': 6,
          'line-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            0,
            16,
            -3,
            22,
            ['*', ['zoom'], -3],
          ],
        },
      },
      'routes',
    );

    map.addLayer(
      {
        id: 'route-arrows',
        type: 'symbol',
        source: 'routes',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 100,
          'text-field': '→',
          'text-size': 16,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-keep-upright': false,
          'text-anchor': 'bottom',
          'text-padding': 0,
          'text-line-height': 1,
          'text-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            ['literal', [0, 0]],
            22,
            ['literal', [0, -2]],
          ],
        },
        paint: {
          'text-color': '#5301a4',
          'text-opacity': 0.9,
          'text-halo-color': '#fff',
          'text-halo-width': 2,
        },
      },
      'stops',
    );

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

    map.addLayer(
      {
        id: 'routes-path',
        type: 'line',
        source: 'routes-path',
        layout: {
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#f01b48',
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            '#f01b48',
            0.5,
            '#972FFE',
            1,
            '#f01b48',
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            ['boolean', ['feature-state', 'fadein'], false],
            0.07,
            0.5, // default
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            2,
            16,
            5,
            22,
            10,
          ],
        },
      },
      'stops',
    );

    map.addLayer(
      {
        id: 'routes-path-bg',
        type: 'line',
        source: 'routes-path',
        layout: {
          'line-cap': 'round',
        },
        maxzoom: 20,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'fadein'], false],
            'transparent',
            '#fff',
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            6,
            16,
            10,
            22,
            16,
          ],
        },
      },
      'routes-path',
    );

    map.addLayer({
      id: 'route-path-labels',
      type: 'symbol',
      source: 'routes-path',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-field': '{service}',
        'text-size': 14,
        'text-rotation-alignment': 'viewport',
        'text-padding': 0,
        'text-line-height': 1,
      },
      paint: {
        'text-color': '#3a6727',
        'text-halo-color': '#eeffd1',
        'text-halo-width': 2,
        'text-opacity': [
          'case',
          ['boolean', ['feature-state', 'fadein'], false],
          0.1,
          1,
        ],
      },
    });

    map.addLayer(
      {
        id: 'route-path-arrows',
        type: 'symbol',
        source: 'routes-path',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 200,
          'text-field': '→',
          'text-size': 16,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          // 'text-allow-overlap': true,
          // 'text-ignore-placement': true,
          'text-keep-upright': false,
          'text-anchor': 'bottom',
          'text-padding': 0,
          'text-line-height': 1,
          'text-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            ['literal', [0, 0]],
            22,
            ['literal', [0, -2]],
          ],
        },
        paint: {
          'text-color': '#5301a4',
          'text-opacity': 0.9,
          'text-halo-color': '#fff',
          'text-halo-width': 2,
          'text-opacity': [
            'case',
            ['boolean', ['feature-state', 'fadein'], false],
            0.1,
            1,
          ],
        },
      },
      'stops',
    );

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
          if (hoveredRouteID && hoveredRouteID === currentHoveredRouteID)
            return;

          if (hoveredRouteID) {
            map.setFeatureState(
              {
                source: 'routes-path',
                id: hoveredRouteID,
              },
              { hover: false, fadein: false },
            );
          }

          hoveredRouteID = currentHoveredRouteID;
          map.setFeatureState(
            {
              source: 'routes-path',
              id: hoveredRouteID,
            },
            { hover: true, fadein: false },
          );

          STORE.routesPathServices?.forEach((service) => {
            const id = encode(service);
            if (hoveredRouteID === id) return;
            map.setFeatureState(
              {
                source: 'routes-path',
                id,
              },
              { hover: false, fadein: true },
            );
          });

          highlightRouteTag(decode(hoveredRouteID));
        }
      });
      map.on('mouseleave', 'routes-path', () => {
        mapCanvas.style.cursor = '';
        if (hoveredRouteID) {
          STORE.routesPathServices?.forEach((service) => {
            const id = encode(service);
            map.setFeatureState(
              {
                source: 'routes-path',
                id,
              },
              { fadein: false, hover: false },
            );
          });
          hoveredRouteID = null;
          highlightRouteTag();
        }
      });
    });

    // Traffic
    map.addSource('traffic', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1',
    });
    map.addLayer(
      {
        id: 'traffic',
        type: 'line',
        source: 'traffic',
        'source-layer': 'traffic',
        minzoom: 14,
        filter: ['all', ['==', '$type', 'LineString'], ['has', 'congestion']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: 'none',
        },
        paint: {
          'line-width': 3,
          'line-offset': [
            'case',
            [
              'match',
              ['get', 'class'],
              ['link', 'motorway_link', 'service', 'street'],
              true,
              false,
            ],
            6,
            ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false],
            6,
            ['==', 'class', 'primary'],
            12,
            ['==', 'class', 'trunk'],
            12,
            ['==', 'class', 'motorway'],
            9,
            6,
          ],
          'line-color': [
            'match',
            ['get', 'congestion'],
            'low',
            'rgba(36, 218, 26, .2)',
            'moderate',
            'rgba(253, 149, 0, .55)',
            'heavy',
            'rgba(252, 77, 77, .65)',
            'severe',
            'rgba(148, 41, 76, .75)',
            'transparent',
          ],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 14.1, 0, 16, 1],
        },
      },
      'road-label',
    );

    // Service live buses
    map.addSource('buses-service', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    map.loadImage(busTinyImagePath, (e, img) => {
      if (e) throw e;
      map.addImage('bus-tiny', img);
    });
    map.addLayer({
      id: 'buses-service',
      type: 'symbol',
      source: 'buses-service',
      minzoom: 9,
      layout: {
        'icon-image': 'bus-tiny',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['step', ['zoom'], 0.3, 14, 0.35, 15, 0.45, 16, 0.55],
      },
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

    map.addLayer(
      {
        id: 'routes-between',
        type: 'line',
        source: 'routes-between',
        filter: ['!=', ['get', 'type'], 'walk'],
        layout: {
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'start',
            '#f01b48',
            'end',
            '#972FFE',
            '#f01b48',
          ],
          'line-opacity': 0.7,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            2,
            16,
            5,
            22,
            10,
          ],
          'line-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            0,
            16,
            -3,
            22,
            ['*', ['zoom'], -3],
          ],
        },
      },
      'stops',
    );

    map.addLayer(
      {
        id: 'routes-between-walk',
        type: 'line',
        source: 'routes-between',
        filter: ['==', ['get', 'type'], 'walk'],
        paint: {
          'line-color': '#007aff',
          'line-dasharray': [2, 2],
          'line-opacity': 0.7,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            2,
            16,
            5,
            22,
            10,
          ],
        },
      },
      'stops-highlight',
    );

    map.addLayer(
      {
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
      },
      'routes-between',
    );

    map.addLayer({
      id: 'route-between-arrows',
      type: 'symbol',
      source: 'routes-between',
      minzoom: 12,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 100,
        'text-field': '→',
        'text-size': 16,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-keep-upright': false,
        'text-anchor': 'bottom',
        'text-padding': 0,
        'text-line-height': 1,
        'text-offset': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12,
          ['literal', [0, 0]],
          22,
          ['literal', [0, -2]],
        ],
      },
      paint: {
        'text-color': '#5301a4',
        'text-opacity': 0.8,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });

    renderRoute();

    // Popover search field
    fuseServices = new Fuse(servicesDataArr, {
      threshold: 0.3,
      keys: ['number', 'name'],
    });
    fuseStops = new Fuse(stopsDataArr, {
      threshold: 0.3,
      keys: ['number', 'name'],
    });

    requestIdleCallback(() => {
      // For cases when user already typed something before fuse.js inits
      if (searchField.current?.value) handleSearch();

      // Finally, show ad
      map.once('idle', () => {
        setTimeout(() => {
          setShowAd(true);
        }, 1000);
      });
    });
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapLoaded) return;
    const handleMapClick = (e) => {
      if (e.originalEvent.altKey) {
        console.log(e.lngLat);
      }
      const { point } = e;
      const features = map.queryRenderedFeatures(point, {
        layers: ['stops', 'stops-icon', 'stops-highlight'],
        validate: false,
      });
      if (features.length) {
        const zoom = map.getZoom();
        const feature = features[0];
        const center = feature.geometry.coordinates;
        if (zoom < 12) {
          // Slowly zoom in first
          map.flyTo({ zoom: zoom + 2, center });
          setShrinkSearch(true);
        } else {
          if (feature.source == 'stops') {
            location.hash = `/stops/${feature.properties.number}`;
          } else {
            _showStopPopover(feature.properties.number);
          }
        }
      } else {
        const { page, subpage } = route;
        if (page === 'stop' && subpage !== 'routes') {
          location.hash = '/';
        } else {
          hideStopPopover();
        }
      }
    };
    map.on('click', handleMapClick);
    return () => map.off('click', handleMapClick);
  }, [mapLoaded, route.page, route.subpage, _showStopPopover, hideStopPopover]);

  const popoverIsUp = useMemo(
    () =>
      (!!showStopPopover ||
        !!showBetweenPopover ||
        !!showArrivalsPopover ||
        !!showServicePopover) &&
      !largerScreen,
    [
      showStopPopover,
      showBetweenPopover,
      showArrivalsPopover,
      showServicePopover,
      largerScreen,
    ],
  );

  // Global shortcuts
  useEffect(() => {
    const handler = (e) => {
      const isFormField =
        e.target &&
        e.target.tagName &&
        /input|textarea|button|select/i.test(e.target.tagName);
      const keydown = e.key.toLowerCase();
      switch (keydown) {
        case '/': {
          console.log('/', isFormField, searchField.current);
          if (isFormField) return;
          if (popoverIsUp) return;
          e.preventDefault();
          searchField.current.focus();
          break;
        }
        case 'escape': {
          if (expandSearch) {
            handleSearchClose();
          } else if (showStopPopover) {
            hideStopPopover();
          } else if (showBetweenPopover) {
            location.hash = '/';
          } else if (showServicePopover) {
            location.hash = '/';
          }
          break;
        }
        default: {
          if (e.shiftKey && e.altKey) {
            document.body.classList.add('alt-mode');
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    expandSearch,
    showStopPopover,
    showBetweenPopover,
    showServicePopover,
    popoverIsUp,
  ]);
  document.addEventListener('keyup', () => {
    document.body.classList.remove('alt-mode');
  });

  const showServicesFloatPill =
    route.page === 'service' && servicesData && routeServices.length > 1;
  const showPassingRoutesFloatPill =
    route.page === 'stop' &&
    route.subpage === 'routes' &&
    stopsData &&
    stopsData[route.value];

  return (
    <>
      <About />
      <div
        id="search-popover"
        ref={searchPopover}
        class={`popover ${expandSearch ? 'expand' : ''} ${
          shrinkSearch ? 'shrink' : ''
        } ${routeLoading ? 'loading' : ''}`}
      >
        <div
          id="popover-float"
          hidden={!(showServicesFloatPill || showPassingRoutesFloatPill)}
        >
          <div class="float-pill" ref={floatPill}>
            <a href="#/" class="popover-close">
              &times;
            </a>
            {showServicesFloatPill && (
              <>
                <div class="service-flex">
                  <h1>
                    {t('multiRoute.showingServices', {
                      count: routeServices.length,
                    })}
                  </h1>
                </div>
                <div class="services-list">
                  <div>
                    {routeServices.sort(sortServices).map((service) => (
                      <>
                        <a
                          href={`#/services/${service}`}
                          onClick={(e) => clickRoute(e, service)}
                          onMouseEnter={(e) => highlightRoute(e, service)}
                          onMouseLeave={unhighlightRoute}
                          class="service-tag"
                          data-service={service}
                        >
                          {service}
                          <span
                            class="close"
                            title="Remove this service"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newRouteServices = routeServices.filter(
                                (s) => s !== service,
                              );
                              location.hash = `/services/${newRouteServices.join(
                                '~',
                              )}`;
                              unhighlightRoute();
                            }}
                          >
                            &times;
                          </span>
                        </a>
                      </>
                    ))}
                    <button
                      type="button"
                      class="plus"
                      onClick={() => {
                        setExpandSearch(true);
                        setExpandedSearchOnce(true);
                      }}
                      title={t('multiRoute.addRoute')}
                    />
                  </div>
                  {!!intersectStops.length && (
                    <>
                      <h2>
                        {t('multiRoute.intersectingStops', {
                          count: intersectStops.length,
                        })}
                      </h2>
                      <ul class="simple-stops-list">
                        {intersectStops.map((s) => {
                          const stop = stopsData[s];
                          return (
                            <li key={stop.number}>
                              <a
                                href={`#/stops/${stop.number}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  zoomToStop(s);
                                  // onStopClickAgain={_showStopPopover}
                                }}
                              >
                                <b class="stop-tag">{stop.number}</b>{' '}
                                <span class="stop-name">{stop.name}</span>{' '}
                                {routeServices.length > 2 && (
                                  <span class="services-meta-list">
                                    {stopsData[stop.number].services
                                      .filter((s) => routeServices.includes(s))
                                      .sort(sortServices)
                                      .join(' ')}
                                  </span>
                                )}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </>
            )}
            {showPassingRoutesFloatPill && (
              <>
                <div class="service-flex">
                  <span class="stop-tag">{route.value}</span>
                  <div>
                    <h1>{stopsData[route.value].name}</h1>
                  </div>
                </div>
                <div class="services-list" onClick={unhighlightRoute}>
                  <h2>
                    {t('passingRoutes.passingRoutes', {
                      count: stopsData[route.value].services.length,
                    })}{' '}
                    ·{' '}
                    <a
                      href={`#/services/${stopsData[route.value].services
                        .sort(sortServices)
                        .join('~')}`}
                    >
                      {t('glossary.multiRouteMode')} ⊕
                    </a>
                  </h2>
                  {stopsData[route.value].services
                    .sort(sortServices)
                    .map((service) => (
                      <a
                        href={`#/services/${service}`}
                        onClick={(e) => clickRoute(e, service)}
                        onMouseEnter={(e) => highlightRoute(e, service)}
                        onMouseLeave={unhighlightRoute}
                        class="service-tag"
                        data-service={service}
                      >
                        {service}
                      </a>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div class="popover-inner">
          <div class="popover-search">
            <input
              type="search"
              placeholder={t('search.placeholder')}
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              ref={searchField}
              onfocus={handleSearchFocus}
              oninput={handleSearch}
              onkeydown={handleKeys}
              disabled={!searching && !services.length}
            />
            <button type="button" onclick={handleSearchClose}>
              {t('common.cancel')}
            </button>
          </div>
          <ul
            class={`popover-list ${
              services.length || searching ? '' : 'loading'
            } ${searching ? 'searching' : ''}`}
            ref={servicesList}
            onScroll={handleServicesScroll}
          >
            <li class="ads-li" hidden={!services.length || !showAd}>
              {showAd && <Ad key="ad" />}
            </li>
            {services.length
              ? (expandedSearchOnce ? services : services.slice(0, 25)).map(
                  (s) => {
                    const isServicePage = route.page === 'service';
                    const checked =
                      route.value && route.value.split('~').includes(s.number);
                    return (
                      <li key={s.number}>
                        <a
                          href={`#/services/${s.number}`}
                          class={checked ? 'current' : ''}
                          onMouseEnter={() => previewRoute(s.number)}
                          onMouseLeave={unpreviewRoute}
                        >
                          <b class="service-tag">{s.number}</b> {s.name}
                        </a>
                        <label hidden={!isServicePage}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const { checked } = e.target;
                              let newServices = [];
                              if (checked) {
                                newServices = route.value
                                  .split('~')
                                  .concat(s.number);
                              } else {
                                newServices = route.value
                                  .split('~')
                                  .filter((service) => service !== s.number);
                              }
                              newServices.sort(sortServices);
                              setTimeout(() => {
                                if (newServices.length) {
                                  location.hash = `/services/${newServices.join(
                                    '~',
                                  )}`;
                                } else {
                                  location.hash = '/';
                                }
                              }, 250);
                            }}
                          />
                        </label>
                      </li>
                    );
                  },
                )
              : !searching &&
                [1, 2, 3, 4, 5, 6, 7, 8].map((s, i) => (
                  <li key={s}>
                    <a href="#">
                      <b class="service-tag">&nbsp;&nbsp;&nbsp;</b>
                      <span class="placeholder">
                        █████{i % 3 == 0 ? '███' : ''} ███
                        {i % 2 == 0 ? '████' : ''}
                      </span>
                    </a>
                  </li>
                ))}
            {searching &&
              !!stops.length &&
              stops.map((s) => (
                <li key={s.number}>
                  <a href={`#/stops/${s.number}`}>
                    <b class="stop-tag">{s.number}</b> {s.name}
                  </a>
                </li>
              ))}
            {searching && !stops.length && !services.length && (
              <li class="nada">No results.</li>
            )}
          </ul>
          <div class="sidebar-ads" hidden={!showAd}>
            {showAd && <Ad key="ad2" />}
          </div>
        </div>
      </div>
      <div
        id="stop-popover"
        ref={stopPopover}
        class={`popover ${showStopPopover ? 'expand' : ''}`}
      >
        {stopPopoverData && (
          <>
            <a href="#/" onClick={hideStopPopover} class="popover-close">
              &times;
            </a>
            <header>
              <h1 onClick={() => zoomToStop(stopPopoverData.number)}>
                <b class="stop-tag">{stopPopoverData.number}</b>{' '}
                {stopPopoverData.name}
              </h1>
            </header>
            <ScrollableContainer class="popover-scroll">
              <h2>
                {t('glossary.nServices', {
                  count: stopPopoverData.services.length,
                })}{' '}
                ∙{' '}
                <a
                  href={`/bus-first-last/#${stopPopoverData.number}`}
                  target="_blank"
                >
                  {t('stop.firstLastBus')}{' '}
                  <img
                    src={openNewWindowImagePath}
                    width="12"
                    height="12"
                    alt=""
                    class="new-window"
                  />
                </a>
              </h2>
              <BusServicesArrival
                active={showStopPopover}
                map={map}
                showBusesOnMap={route.page !== 'service'}
                id={stopPopoverData.number}
                services={stopPopoverData.services}
              />
            </ScrollableContainer>
            <div class="popover-footer">
              <div class="popover-buttons alt-hide">
                <a
                  href={`/bus-arrival/#${stopPopoverData.number}`}
                  target="_blank"
                  onClick={openBusArrival}
                  class="popover-button"
                >
                  {t('glossary.busArrivals')}{' '}
                  <img
                    src={openNewWindowBlueImagePath}
                    width="16"
                    height="16"
                    alt=""
                  />
                </a>
                {stopPopoverData.services.length > 1 && (
                  <a
                    href={`#/stops/${stopPopoverData.number}/routes`}
                    class="popover-button"
                  >
                    {t('glossary.passingRoutes')}{' '}
                    <img
                      src={passingRoutesBlueImagePath}
                      width="16"
                      height="16"
                      alt=""
                    />
                  </a>
                )}
              </div>
              <div class="popover-buttons alt-show-flex">
                <button
                  onClick={() => setStartStop(stopPopoverData.number)}
                  class="popover-button"
                >
                  Set as Start
                </button>
                <button
                  onClick={() => setEndStop(stopPopoverData.number)}
                  class="popover-button"
                >
                  Set as End
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <div
        ref={servicePopover}
        id="service-popover"
        class={`popover ${showServicePopover ? 'expand' : ''}`}
        key={``}
      >
        <a href="#/" onClick={navBackToStop} class="popover-close">
          &times;
        </a>
        {servicesData && routeServices.length && (
          <>
            <header>
              <h1>
                <b class="service-tag">{routeServices[0]}</b>
                {servicesData[routeServices[0]].name}
              </h1>
            </header>
            <ScrollableContainer
              class="popover-scroll"
              scrollToTopKey={`sttk-${routeServices[0]}`}
            >
              <h2>
                {t('glossary.nRoutes', {
                  count: servicesData[routeServices[0]].routes.length,
                })}{' '}
                ∙{' '}
                {servicesData[routeServices[0]].routes
                  .map((route) => t('glossary.nStops', { count: route.length }))
                  .join(' ∙ ')}
                &nbsp;&nbsp;
                <button
                  type="button"
                  class="plus"
                  onClick={() => {
                    setExpandSearch(true);
                    setExpandedSearchOnce(true);
                  }}
                  title={t('multiRoute.addRoute')}
                />
              </h2>
              <StopsList
                routes={servicesData[routeServices[0]].routes}
                stopsData={stopsData}
                onStopClick={zoomToStop}
                onStopClickAgain={_showStopPopover}
              />
              <div class="callout info">
                <span class="legend-opposite" /> {t('service.oppositeLegend')}
              </div>
            </ScrollableContainer>
          </>
        )}
      </div>
      <div
        id="between-popover"
        ref={betweenPopover}
        class={`popover ${showBetweenPopover ? 'expand' : ''}`}
      >
        {showBetweenPopover && [
          <a href="#/" onClick={resetStartEndStops} class="popover-close">
            &times;
          </a>,
          <header>
            <h1>
              <small>Routes between</small>
              <br />
              <b class="stop-tag">
                {showBetweenPopover.startStop.number}
              </b> and{' '}
              <b class="stop-tag">{showBetweenPopover.endStop.number}</b>
            </h1>
          </header>,
          <div class="popover-scroll">
            <div class="callout warning">
              This is a beta feature. Directions and routes may not be correct.
            </div>
            <h2>Direct routes</h2>
            <BetweenRoutes
              results={showBetweenPopover.results[0]}
              onClickRoute={(e, result) =>
                renderBetweenRoute({
                  e,
                  startStop: showBetweenPopover.startStop,
                  endStop: showBetweenPopover.endStop,
                  result,
                })
              }
            />
            <h2>Alternative routes</h2>
            <h3>
              Nearby arrival stop: {showBetweenPopover.nearestEndStop.number} (
              {showBetweenPopover.endWalkMins}-min walk)
            </h3>
            <BetweenRoutes
              results={showBetweenPopover.results[1]}
              nearbyEnd={true}
              onClickRoute={(e, result) =>
                renderBetweenRoute({
                  e,
                  startStop: showBetweenPopover.startStop,
                  endStop: showBetweenPopover.endStop,
                  result,
                })
              }
            />
            <h3>
              Nearby departure stop:{' '}
              {showBetweenPopover.nearestStartStop.number} (
              {showBetweenPopover.startWalkMins}-min walk)
            </h3>
            <BetweenRoutes
              results={showBetweenPopover.results[2]}
              nearbyStart={true}
              onClickRoute={(e, result) =>
                renderBetweenRoute({
                  e,
                  startStop: showBetweenPopover.startStop,
                  endStop: showBetweenPopover.endStop,
                  result,
                })
              }
            />
            <h3>
              Nearby departure &amp; arrival stops:{' '}
              {showBetweenPopover.nearestStartStop.number} -{' '}
              {showBetweenPopover.nearestEndStop.number}
            </h3>
            <BetweenRoutes
              results={showBetweenPopover.results[3]}
              nearbyStart={true}
              nearbyEnd={true}
              onClickRoute={(e, result) =>
                renderBetweenRoute({
                  e,
                  startStop: showBetweenPopover.startStop,
                  endStop: showBetweenPopover.endStop,
                  result,
                })
              }
            />
          </div>,
        ]}
      </div>
      <div
        id="arrivals-popover"
        class={`popover ${showArrivalsPopover ? 'expand' : ''}`}
      >
        {showArrivalsPopover && [
          <a href="#/" onClick={closeBusArrival} class="popover-close">
            &times;
          </a>,
          <a
            href={`/bus-arrival/#${showArrivalsPopover.number}`}
            target="_blank"
            onClick={(e) => {
              openBusArrival(e, true);
              closeBusArrival(e);
            }}
            class="popover-popout popover-close"
          >
            Pop out{' '}
            <img src={openNewWindowImagePath} width="16" height="16" alt="" />
          </a>,
          <div class="popover-scroll">
            <iframe src={showArrivalsPopover.webviewURL}></iframe>
          </div>,
        ]}
      </div>
    </>
  );
};

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(
      new URL('../service-worker.js', import.meta.url),
      { type: 'module' },
    );
  });
}

if (
  matchMedia('(display-mode: standalone)').matches ||
  'standalone' in navigator
) {
  gtag('event', 'pwa_load', {
    event_category: 'PWA',
    event_label: 'standalone',
    value: true,
    non_interaction: true,
  });
}

if (window.navigator.standalone) {
  document.body.classList.add('standalone');

  // Refresh map size when dismissing software keyboard
  // https://stackoverflow.com/a/19464029/20838
  document.addEventListener('focusout', () => {
    if (_map) _map.resize();
  });

  // Enable CSS active states
  document.addEventListener('touchstart', () => {}, false);
}

const isSafari = navigator.vendor && navigator.vendor.indexOf('Apple') !== -1;
if (isSafari && !window.navigator.standalone) {
  setTimeout(function () {
    const ratio = window.devicePixelRatio;
    const canvas = document.createElement('canvas');
    const w = (canvas.width = window.screen.width * ratio);
    const h = (canvas.height = window.screen.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F9F5ED';
    ctx.fillRect(0, 0, w, h);
    const icon = new Image();
    icon.onload = () => {
      const aspectRatio = icon.width / icon.height;
      icon.width = w / 2;
      icon.height = w / 2 / aspectRatio;
      ctx.drawImage(
        icon,
        (w - icon.width) / 2,
        (h - icon.height) / 2,
        icon.width,
        icon.height,
      );
      document.head.insertAdjacentHTML(
        'beforeend',
        `<link rel="apple-touch-startup-image" href="${canvas.toDataURL()}">`,
      );
    };
    icon.src = iconSVGPath;
  }, 5000);
}
