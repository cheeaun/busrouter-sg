import { h, render, Component } from 'preact';
import fetchCache from './utils/fetchCache';
import { sortServices } from './utils/bus';
import Ad from './ad';

import firstLastJSONPath from '../data/3/firstlast.final.json';
import stopsJSONPath from '../data/3/stops.final.json';

const timeFormat = (time) => {
  if (!/\d{4}/.test(time)) return time;
  let h = parseInt(time.slice(0, 2), 10);
  const m = time.slice(2);
  let ampm = 'AM';
  if (h >= 12 && h < 24) {
    ampm = 'PM';
    h -= 12;
  } else if (h === 0 || h === 24) {
    h = 12;
  }
  return `${h}:${m} ${ampm}`;
};

const formatDuration = (duration) => { // hours
  const durationMins = duration * 60;
  const hour = Math.floor(durationMins / 60);
  const minute = Math.round(durationMins % 60);
  let str = '';
  if (hour) str = `${hour}h`;
  if (minute) str += ` ${minute}m`;
  return str.trim();
};

const convertTimeToNumber = (time) => {
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(2), 10);
  return h + (m/60);
}

const TimeRanger = ({ values }) => {
  const [first, last] = values;
  if (!first || !/\d+/.test(first)) return <div class="time-ranger nada" />;
  const firstVal = convertTimeToNumber(first);
  const lastVal = convertTimeToNumber(/^00/.test(first) ? last : last.replace(/^00/, '24'));
  const left = firstVal / 24 * 100;
  const width = (lastVal - firstVal) / 24 * 100;
  const duration = lastVal - firstVal;
  return (
    <div>
      <div class="time-ranger">
        {/^00/.test(last) && !/^00/.test(first) && <div class="bar" style={{
          left: 0,
          width: `${parseInt(last, 10) / 2400 * 100}%`
        }} />}
        <div class="bar" style={{
          left: `${left}%`,
          width: `${width}%`,
        }} />
      </div>
      <span class="time-duration">{formatDuration(duration)}</span>
    </div>
  );
};

class FirstLastTimes extends Component {
  state = {
    stop: null,
    stopName: null,
    data: [],
  }
  componentDidMount() {
    Promise.all([
      fetchCache(firstLastJSONPath, 24 * 60),
      fetchCache(stopsJSONPath, 24 * 60),
    ]).then(([flData, stopsData]) => {
      window.onhashchange = () => {
        const stop = location.hash.slice(1);
        const data = flData[stop];
        if (!data) {
          alert('Bus stop code not found.');
          return;
        }
        const stopName = stopsData[stop][2];
        this.setState({
          stop,
          stopName,
          data: data.map(d => d.split(/\s+/)).sort((a, b) => sortServices(a[0], b[0])),
        });

        document.title = `Approximate first & last bus arrival times for ${stop}: ${stopName}`;
      }
      window.onhashchange();
    });
  }
  render() {
    const { stop, stopName, data } = this.state;
    return (
      <div>
        {!!data.length && <Ad />}
        <h1>
          Approximate first &amp; last bus arrival times&nbsp;for<br />
          <b><span class="stop-tag">{stop}</span> {stopName}</b>
        </h1>
        <p class="legend">
          <span><span class="abbr">WD</span> Weekdays</span>
          <span><span class="abbr">SAT</span> Saturdays</span>
          <span><span class="abbr">SUN</span> Sundays &amp; Public Holidays</span>
        </p>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th></th>
              <th>First bus</th>
              <th>Last bus</th>
              <th class="timerange-header">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
              </th>
            </tr>
          </thead>
          {data.map(d => {
            const [ service, ...times ] = d;
            const [ wd1raw, wd2raw, sat1raw, sat2raw, sun1raw, sun2raw ] = times;
            const [ wd1, wd2, sat1, sat2, sun1, sun2 ] = times.map(timeFormat);
            return (
              <tbody>
                <tr>
                  <td rowspan="3">{service}</td>
                  <th><abbr title="Weekdays">WD</abbr></th>
                  <td title={wd1raw}>{wd1}</td>
                  <td title={wd2raw}>{wd2}</td>
                  <td class="time-cell"><TimeRanger values={[wd1raw, wd2raw]} /></td>
                </tr>
                <tr>
                  <th><abbr title="Saturdays">SAT</abbr></th>
                  <td title={sat1raw}>{sat1}</td>
                  <td title={sat2raw}>{sat2}</td>
                  <td class="time-cell"><TimeRanger values={[sat1raw, sat2raw]} /></td>
                </tr>
                <tr>
                  <th><abbr title="Sundays &amp; Public Holidays">SUN</abbr></th>
                  <td title={sun1raw}>{sun1}</td>
                  <td title={sun2raw}>{sun2}</td>
                  <td class="time-cell"><TimeRanger values={[sun1raw, sun2raw]} /></td>
                </tr>
              </tbody>
            );
          })}
          <tfoot>
            <tr>
              <td colspan="4">
                {data.length} service{data.length === 1 ? '' : 's'} &middot; <a href="/">BusRouter SG</a>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }
}

const $firstlast = document.getElementById('firstlast');
render(<FirstLastTimes />, $firstlast);
