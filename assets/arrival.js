import { h, render, Component } from 'preact';
import { MAPBOX_ACCESS_TOKEN } from './config';
import { timeDisplay, sortServicesPinned } from './utils/bus';
import fetchCache from './utils/fetchCache';
import Ad from './ad';
import setIcon from '../utils/setIcon';

import wheelchairImagePath from './images/wheelchair.svg';
import busSingleImagePath from './images/bus-single.svg';
import busDoubleImagePath from './images/bus-double.svg';
import busBendyImagePath from './images/bus-bendy.svg';
import stopsJSONPath from '../data/3/stops.final.json';

const BUSES = {
  sd: {
    alt: 'Single deck bus',
    src: busSingleImagePath,
    width: 18,
  },
  dd: {
    alt: 'Double deck bus',
    src: busDoubleImagePath,
    width: 18,
  },
  bd: {
    alt: 'Bendy bus',
    src: busBendyImagePath,
    width: 24,
  },
};

const WheelChair = () => (
  <img src={wheelchairImagePath} width="10" height="10" alt="Wheelchair accessible" />
);

const Bus = (props) => {
  const { duration_ms, type, load, feature, _ghost, _id } = props;
  const busImage = BUSES[type.toLowerCase()];
  const px = (duration_ms / 1000 / 60) * (duration_ms > 0 ? 10 : 2.5);
  return (
    <span id={_id ? `bus-${_id}` : null} class={`bus ${_ghost ? 'ghost' : ''}`} style={{ transform: `translateX(${px.toFixed(1)}px)` }}>
      <img {...busImage} /><br />
      <span class={`time time-${load.toLowerCase()}`}>{timeDisplay(duration_ms)}</span>
      {feature.toLowerCase() === 'wab' && <WheelChair />}
    </span>
  );
};

let BUSID = 1;
const busID = () => BUSID++;
const isSameBus = (b1, b2) => b1.feature === b2.feature && b1.type === b2.type;

class BusLane extends Component {
  constructor(props) {
    super(props);
    const { buses } = props;
    this.state = {
      buses: buses.filter(b => typeof b.duration_ms === 'number').map(b => {
        b._id = busID();
        return b;
      }),
    };
  }
  componentWillReceiveProps(nextProps) {
    const nextBuses = nextProps.buses.filter(nb => typeof nb.duration_ms === 'number').map(nb => {
      delete nb._id;
      return nb;
    });
    if (this.props.no === nextProps.no) {
      const buses = this.props.buses.filter(b => !b._ghost); // Remove previously ghosted buses
      buses.forEach((b, i) => {
        // Next bus requirements/checks
        // - Within range of duration_ms of current bus
        // - Not assigned with ID (possibly from previous loop execution)
        // - Same bus type as current bus
        const latestNextBus = nextBuses.find(nb => {
          if (nb._id || !isSameBus(b, nb)) return false;
          const d = (nb.duration_ms - b.duration_ms)/1000/60;
          return d > -5 && d < 3;
        });
        if (latestNextBus) {
          latestNextBus._id = b._id; // Assign ID for marking
        } else {
          // Insert "ghost" bus that will dissapear into thin air
          b._ghost = true;
          nextBuses.splice(i, 0, b);
        }
      });
    }
    // Fill up the left-overs, usually for sudden new next buses
    nextBuses.forEach(nb => {
      if (!nb._id) nb._id = busID();
    });
    this.setState({ buses: nextBuses });
  }
  render(_, state) {
    return (
      <div class="bus-lane">
        {state.buses.map(b => <Bus key={b._id} {...b} />)}
      </div>
    );
  }
}

let arrivalsTimeout;
class ArrivalTimes extends Component {
  constructor() {
    super();

    let pinnedServices = [];
    try {
      pinnedServices = JSON.parse(localStorage.getItem('busroutersg.arrival.pinnedServices') || []);
    } catch (e) { }

    this.state = {
      stopsData: null,
      busStop: null,
      services: null,
      pinnedServices,
    };
  }
  async componentDidMount() {
    const stopsData = await fetchCache(stopsJSONPath, 24 * 60);
    this.setState({ stopsData });

    window.onhashchange = () => {
      const code = location.hash.slice(1);
      clearTimeout(arrivalsTimeout);

      if (code) {
        const stop = stopsData[code];
        if (stop) {
          const [lng, lat, name] = stop;
          document.title = `Bus arrival times for ${code + ' - ' + name}`;
          document.querySelectorAll('[name="apple-mobile-web-app-title"]')[0].setAttribute("content", name);
          this.setState({
            busStop: { code, name, lat, lng },
          });
          this._fetchServices();
        } else {
          alert('Invalid bus stop code.');
        }
      } else {
        this.setState({ busStop: null });
      }
    }
    window.onhashchange();
  }
  componentWillReceiveProps(props) {
    clearTimeout(arrivalsTimeout);
    this._fetchServices();
  }
  _fetchServices = () => {
    const { busStop } = this.state;
    if (!busStop) return;
    const id = busStop.code;
    fetch(`https://arrivelah.busrouter.sg/?id=${id}`).then(r => r.json()).then(results => {
      this.setState({
        services: results.services,
      });
      arrivalsTimeout = setTimeout(() => {
        requestAnimationFrame(this._fetchServices);
      }, 15 * 1000); // 15 seconds
    }).catch(e => {
      console.error(e);
      arrivalsTimeout = setTimeout(() => {
        requestAnimationFrame(this._fetchServices);
      }, 3 * 1000); // 3 seconds
    });
  }
  _togglePin = (no) => {
    const { pinnedServices } = this.state;
    if (pinnedServices.includes(no)) {
      const index = pinnedServices.indexOf(no);
      pinnedServices.splice(index, 1);
    } else {
      setIcon(no);
      pinnedServices.push(no);
    }
    this.setState({ pinnedServices });
    try {
      localStorage.setItem('busroutersg.arrival.pinnedServices', JSON.stringify(pinnedServices));
    } catch (e) { }
  }
  render(_, state) {
    const { busStop, stopsData, services, pinnedServices } = state;
    if (!busStop) {
      if (stopsData) {
        return (
          <ul class="stops-list">
            {Object.keys(stopsData).map(stop => (
              <li><a href={`#${stop}`}>{stopsData[stop][2]}</a></li>
            ))}
          </ul>
        );
      }
      return;
    }

    const { code, name, lat, lng } = busStop;
    if (services) services.sort(sortServicesPinned(pinnedServices));

    return (
      <div>
        <div id="bus-stop-map">
          <img src={`https://busrouter.sg/staticmaps/${lng},${lat},17,0,60/400x200@2x?access_token=${MAPBOX_ACCESS_TOKEN}`} alt="Bus stop map" />
        </div>
        <h1>
          Bus arrival times for
          <b id="bus-stop-name">
            <span class="stop-tag">{code}</span> {name}
          </b>
        </h1>
        <table>
          {services ?
            services.length ? [
              <tbody class={!services.length ? 'loading' : ''}>
                {services.map(({ no, next, next2, next3 }) => {
                  const pinned = pinnedServices.includes(no);
                  return (
                    <tr class={pinned ? 'pin' : ''}>
                      <th onClick={(e) => {
                        e.preventDefault();
                        this._togglePin(no);
                      }}>{no}</th>
                      <td class="bus-lane-cell">
                        <BusLane no={no} buses={[next, next2, next3]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>,
              <tfoot>
                <tr>
                  <td colspan="2">
                    <span>
                      <span class="load load-sea" /> Seats available
                    </span>
                    <span>
                      <span class="load load-sda" /> Standing available
                    </span>
                    <span>
                      <span class="load load-lsd" /> Limited standing
                    </span>
                    <span>
                      <WheelChair /> Wheelchair accessible
                    </span>
                  </td>
                </tr>
              </tfoot>
            ] : (
                <tbody>
                  <tr>
                    <td class="blank">No arrival times available.</td>
                  </tr>
                </tbody>
              ) : (
              <tbody class="loading">
                <tr>
                  <td>Loading&hellip;</td>
                </tr>
              </tbody>
            )}
        </table>
        {!!services && !!services.length && (
          <footer>
            <small><b>Note</b>: Arrival times refresh every 15 seconds.</small>
          </footer>
        )}
        <Ad />
      </div>
    );
  }
}

const $arrivals = document.getElementById('arrivals');
render(<ArrivalTimes />, $arrivals);
