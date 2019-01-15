import { h, Component } from 'preact';
import { encode } from '../utils/specialID';
import getRoute from '../utils/getRoute';
import { timeDisplay, sortServices } from '../utils/bus';
import cheapRuler from 'cheap-ruler';
const ruler = cheapRuler(1.3);

export default class BusServicesArrival extends Component {
  state = {
    isLoading: false,
    servicesArrivals: {},
  }
  componentDidMount() {
    this._fetchServices();
    this._setupMap();
  }
  componentWillUnmount() {
    this._removeBuses();
    clearTimeout(this._arrivalsTimeout);
  }
  _setupMap = () => {
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
  _removeBuses = () => {
    const { map } = this.props;
    map.getSource('buses').setData({
      type: 'FeatureCollection',
      features: [],
    });
  }
  componentDidUpdate(prevProps) {
    if (prevProps.id !== this.props.id) {
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