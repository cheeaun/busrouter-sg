import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { encode } from '../utils/specialID';
import getRoute from '../utils/getRoute';
import { timeDisplay, sortServices } from '../utils/bus';
import cheapRuler from 'cheap-ruler';
const ruler = cheapRuler(1.3);

const addMapBuses = (map) => {
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
        'text-field': '{number}',
        'text-size': 10,
        'text-font': ['Roboto Medium', 'Noto Sans Regular'],
        'text-variable-anchor': ['left', 'right', 'bottom', 'top'],
        'text-justify': 'auto',
        'text-padding': [
          'step', ['zoom'],
          4,
          15.5, 6,
          16, 8
        ],
      },
      paint: {
        'text-color': '#00454d',
        'text-halo-color': '#fff',
        'text-halo-width': 1,
        'text-opacity': .8,
      },
    });
  }
};

const removeMapBuses = (map) => {
  map.getSource('buses').setData({
    type: 'FeatureCollection',
    features: [],
  });
};

export default function BusServicesArrival({ services, id, map }) {
  if (!id || !map) return;
  const [isLoading, setIsLoading] = useState(false);
  const [servicesArrivals, setServicesArrivals] = useState({});
  const route = getRoute();
  let arrivalsTimeout;
  let arrivalsRAF;

  const fetchServices = () => {
    setIsLoading(true);
    fetch(`https://arrivelah2.busrouter.sg/?id=${id}`).then(res => res.json()).then(results => {
      const servicesArrivals = {};
      const { services } = results;
      services.forEach(service => servicesArrivals[service.no] = service.next.duration_ms);
      setServicesArrivals(servicesArrivals);
      setIsLoading(false);

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

      arrivalsTimeout = setTimeout(() => {
        arrivalsRAF = requestAnimationFrame(fetchServices);
      }, 15 * 1000); // 15 seconds
    });
  };

  useEffect(() => {
    fetchServices();
    addMapBuses(map);
    return () => {
      removeMapBuses(map);
      clearTimeout(arrivalsTimeout);
      cancelAnimationFrame(arrivalsRAF);
    };
  }, [id]);

  return (
    <p class={`services-list ${isLoading ? 'loading' : ''}`}>
      {services.sort(sortServices).map(service => (
        <Fragment>
          <a
            href={`#/services/${service}`}
            class={`service-tag ${route.page === 'service' && service === route.value ? 'current' : ''}`}>
            {service}
            {servicesArrivals[service] && <span>{timeDisplay(servicesArrivals[service])}</span>}
          </a>
          {' '}
        </Fragment>
      ))}
    </p>
  );
};
