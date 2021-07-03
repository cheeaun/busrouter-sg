import { h, Fragment } from 'preact';
import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import { encode } from '../utils/specialID';
import getRoute from '../utils/getRoute';
import { setRafInterval, clearRafInterval } from '../utils/rafInterval';
import { timeDisplay, sortServices } from '../utils/bus';
import CheapRuler from 'cheap-ruler';
const ruler = new CheapRuler(1.3);

import busTinyImagePath from '../images/bus-tiny.png';

const setupBusesStopLayerOnce = (map) => {
  if (!map) return;
  if (!map.getSource('buses-stop')) {
    map.addSource('buses-stop', {
      type: 'geojson',
      tolerance: 10,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    if (!map.hasImage('bus-tiny')) {
      map.loadImage(busTinyImagePath, (e, img) => {
        if (!map.hasImage('bus-tiny')) map.addImage('bus-tiny', img);
      });
    }
    map.addLayer({
      id: 'buses-stop',
      type: 'symbol',
      source: 'buses-stop',
      minzoom: 11,
      layout: {
        'icon-image': 'bus-tiny',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['step', ['zoom'], 0.25, 15, 0.3, 16, 0.4],
        'text-field': ['step', ['zoom'], '', 15, ['get', 'number']],
        'text-optional': true,
        'text-size': 10,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-variable-anchor': ['left', 'right', 'bottom', 'top'],
        'text-justify': 'auto',
        'text-padding': ['step', ['zoom'], 4, 15, 6, 16, 8],
      },
      paint: {
        'text-color': '#00454d',
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });
  }
};

const removeMapBuses = (map) => {
  if (!map) return;
  map.getSource('buses-stop')?.setData({
    type: 'FeatureCollection',
    features: [],
  });
};

const timeout = (n) => new Promise((f) => setTimeout(f, n));

export default function BusServicesArrival({
  services,
  id,
  map,
  active,
  showBusesOnMap,
}) {
  if (!id) return;
  const [isLoading, setIsLoading] = useState(false);
  const [servicesArrivals, setServicesArrivals] = useState({});
  const [liveBusCount, setLiveBusCount] = useState(0);
  const route = getRoute();

  let controller;
  const renderStopsTimeout = useRef();
  const fetchServices = useCallback(() => {
    setIsLoading(true);
    controller = new AbortController();
    fetch(`https://arrivelah2.busrouter.sg/?id=${id}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((results) => {
        const servicesArrivals = {};
        const { services } = results;
        services.forEach(
          (service) => (servicesArrivals[service.no] = service.next.duration_ms)
        );
        setServicesArrivals(servicesArrivals);
        setIsLoading(false);

        if (showBusesOnMap) {
          setupBusesStopLayerOnce(map);
          renderStopsTimeout.current = setTimeout(
            () => {
              const servicesWithCoords = services.filter(
                (s) => s.no && s.next.lat > 0
              );
              setLiveBusCount(servicesWithCoords.length);
              const pointMargin = 100;
              const servicesWithFixedCoordsPromises = servicesWithCoords.map(
                async (s) => {
                  await timeout(0); // Forces this to be async
                  const coords = [s.next.lng, s.next.lat];
                  const point = map.project(coords);
                  let shortestDistance = Infinity;
                  let nearestCoords;
                  if (point.x && point.y) {
                    const features = map
                      .queryRenderedFeatures(
                        [
                          [point.x - pointMargin, point.y - pointMargin],
                          [point.x + pointMargin, point.y + pointMargin],
                        ],
                        {
                          validate: false,
                        }
                      )
                      .filter((f) => {
                        return (
                          f.sourceLayer === 'road' &&
                          f.layer.type === 'line' &&
                          f.properties.class != 'path' &&
                          !/(pedestrian|sidewalk|steps)/.test(f.layer.id)
                        );
                      });
                    features.forEach((f) => {
                      const nearestPoint = ruler.pointOnLine(
                        f.geometry.coordinates,
                        coords
                      );
                      if (nearestPoint.t) {
                        const distance = ruler.distance(
                          coords,
                          nearestPoint.point
                        );
                        if (distance < shortestDistance) {
                          shortestDistance = distance;
                          nearestCoords = nearestPoint.point;
                        }
                      }
                    });
                    if (nearestCoords && shortestDistance * 1000 < 10) {
                      // Only within 10m
                      console.log(
                        `Fixed bus position: ${s.no} - ${(
                          shortestDistance * 1000
                        ).toFixed(3)}m`
                      );
                      s.next = {
                        lng: nearestCoords[0],
                        lat: nearestCoords[1],
                      };
                    }
                  }
                  return s;
                }
              );
              requestAnimationFrame(async () => {
                const servicesWithFixedCoords = await Promise.all(
                  servicesWithFixedCoordsPromises
                );
                map.getSource('buses-stop').setData({
                  type: 'FeatureCollection',
                  features: servicesWithFixedCoords.map((s) => ({
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
              });
            },
            map.loaded() ? 0 : 1000
          );
        }
      })
      .catch(() => {
        // Silent fail
      });
  }, [id]);

  useEffect(() => {
    let intervalID;
    if (active) {
      intervalID = setRafInterval(fetchServices, 15 * 1000); // 15 seconds
    }
    return () => {
      clearRafInterval(intervalID);
      controller?.abort();
      clearTimeout(renderStopsTimeout.current);
      removeMapBuses(map);
    };
  }, [id, active, showBusesOnMap]);

  const servicesValue = route.value?.split('~') || [];

  return (
    <>
      <p class={`services-list ${isLoading ? 'loading' : ''}`}>
        {services.sort(sortServices).map((service) => (
          <>
            <a
              href={`#/services/${service}`}
              class={`service-tag ${
                route.page === 'service' && servicesValue.includes(service)
                  ? 'current'
                  : ''
              }`}
            >
              {service}
              {servicesArrivals[service] && (
                <span>{timeDisplay(servicesArrivals[service])}</span>
              )}
            </a>{' '}
          </>
        ))}
      </p>
      {showBusesOnMap && liveBusCount > 0 && (
        <p style={{ marginTop: 5, fontSize: '.8em' }}>
          <span class="live">LIVE</span>{' '}
          <img src={busTinyImagePath} width="16" alt="" /> {liveBusCount} bus
          {liveBusCount === 1 ? '' : 'es'} now on track.
        </p>
      )}
    </>
  );
}
