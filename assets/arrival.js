import { h, render, Component } from 'preact';
import { timeDisplay, sortServicesPinned } from '../utils/bus';
import { MAPBOX_ACCESS_TOKEN } from './config';

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
  <img src={wheelchairImagePath} width="10" height="10" alt="Wheelchair accessible"/>
);

const Bus = (props) => {
  const { duration_ms, type, load, feature } = props;
  const busImage = BUSES[type.toLowerCase()];
  return (
    <span class="bus" style={{transform: `translateX(${(duration_ms/1000/60)*10}px)`}}>
      <img {...busImage}/><br/>
      <span class={`time-${load.toLowerCase()}`}>{timeDisplay(duration_ms)}</span>
      {feature.toLowerCase() === 'wab' && <WheelChair/>}
    </span>
  );
};

let arrivalsTimeout;
class ArrivalTimes extends Component {
  constructor() {
    super();

    let pinnedServices = [];
    try {
      pinnedServices = JSON.parse(localStorage.getItem('busroutersg.arrival.pinnedServices') || []);
    } catch (e) {}

    this.state = {
      stopsData: null,
      busStop: null,
      services: null,
      pinnedServices,
    };
  }
  async componentDidMount(){
    const stopsData = await fetch(stopsJSONPath).then(r => r.json());
    this.setState({ stopsData });

    window.onhashchange = () => {
      const code = location.hash.slice(1);
      clearTimeout(arrivalsTimeout);

      if (code){
        const stop = stopsData[code];
        if (stop){
          const [lng, lat, name] = stop;
          document.title = `Bus arrival times for ${code + ' - ' + name}`;
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
  componentWillReceiveProps(props){
    clearTimeout(arrivalsTimeout);
    this._fetchServices();
  }
  _fetchServices = () => {
    const { busStop } = this.state;
    if (!busStop) return;
    const id = busStop.code;
    fetch(`https://arrivelah.appspot.com/?id=${id}`).then(res => res.json()).then(results => {
      this.setState({
        services: results.services,
      });
      arrivalsTimeout = setTimeout(() => {
        requestAnimationFrame(this._fetchServices);
      }, 15*1000); // 15 seconds
    });
  }
  _togglePin = (no) => {
    const { pinnedServices } = this.state;
    if (pinnedServices.includes(no)){
      const index = pinnedServices.indexOf(no);
      pinnedServices.splice(index, 1);
    } else {
      pinnedServices.push(no);
    }
    this.setState({ pinnedServices });
    try {
      localStorage.setItem('busroutersg.arrival.pinnedServices', JSON.stringify(pinnedServices));
    } catch (e) {}
  }
  render(_, state){
    const { busStop, stopsData, services, pinnedServices } = state;
    if (!busStop){
      if (stopsData){
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
        <header id="bus-stop-header">
          <div id="bus-stop-map">
            <img src={`https://api.mapbox.com/styles/v1/mapbox/streets-v10/static/${lng},${lat},17,0,60/400x200@2x?access_token=${MAPBOX_ACCESS_TOKEN}`} alt="Bus stop map"/>
          </div>
          <h1>
            Bus arrival times for
            <b id="bus-stop-name">
              <span class="stop-tag">{code}</span> {name}
            </b>
          </h1>
        </header>
        <table>
          {services ?
            services.length ? [
            <tbody class={!services.length ? 'loading' : ''}>
              {services.map(({ no, next, next2, next3 }) => {
                const pinned = pinnedServices.includes(no);
                return (
                  <tr class={pinned ? 'pin' : ''}>
                    <th onClick={() => this._togglePin(no)}>{no}</th>
                    <td class="bus-lane-cell">
                      <div class="bus-lane">
                        {[next, next2, next3].map((n, i) => (
                          n.duration_ms ? <Bus {...n}/> : null
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>,
            <tfoot>
              <tr>
                <td colspan="2">
                  <span>
                    <span class="load load-sea"/> Seats available
                  </span>
                  <span>
                    <span class="load load-sda"/> Standing available
                  </span>
                  <span>
                    <span class="load load-lsd"/> Limited standing
                  </span>
                  <span>
                    <WheelChair/> Wheelchair accessible
                  </span>
                </td>
              </tr>
            </tfoot>
          ] : (
            <tbody>
              <tr>
                <td>No arrival times available.</td>
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
        <footer>
          <small><b>Note</b>: Arrival times refresh every 15 seconds.</small>
        </footer>
      </div>
    );
  }
}

const $arrivals = document.getElementById('arrivals');
render(<ArrivalTimes />, $arrivals);
