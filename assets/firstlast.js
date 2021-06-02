import { h, render, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import fetchCache from './utils/fetchCache';
import { sortServices } from './utils/bus';
import Ad from './ad';

const dataPath = 'https://data.busrouter.sg/v1/';
const firstLastJSONPath = dataPath + 'firstlast.min.json';
const stopsJSONPath = dataPath + 'stops.min.json';

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

const formatDuration = (duration) => {
  // hours
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
  return h + m / 60;
};

const TimeRanger = ({ values }) => {
  const nadaEl = <div class="time-ranger nada" />;
  if (!values) return nadaEl;
  const [first, last] = values;
  if (!first || !/\d+/.test(first)) return nadaEl;
  const firstVal = convertTimeToNumber(first);
  const lastVal = convertTimeToNumber(last);
  const left = (firstVal / 24) * 100;
  const duration = (lastVal < firstVal ? lastVal + 24 : lastVal) - firstVal;
  const width = (duration / 24) * 100;
  return (
    <>
      <div class="time-ranger">
        {width + left > 100 && (
          <div
            class="bar"
            style={{
              left: 0,
              width: `${width + left - 100}%`,
            }}
          />
        )}
        <div
          class="bar"
          style={{
            left: `${left}%`,
            width: `${width}%`,
          }}
        />
      </div>
      <span class="time-duration">{formatDuration(duration)}</span>
    </>
  );
};

function FirstLastTimes() {
  const [stop, setStop] = useState(null);
  const [stopName, setStopName] = useState(null);
  const [data, setData] = useState([]);

  const [timeLeft, setTimeLeft] = useState(null);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (!stop || !stopName) return;
    document.title = `Approximate first & last bus arrival times for ${stop}: ${stopName}`;
  }, [stop, stopName]);

  useEffect(() => {
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

        setStop(stop);
        setStopName(stopsData[stop][2]);
        setData(
          data
            .map((d) => {
              const serviceTimings = d.split(/\s+/);
              // If '=', means it's same timings as weekdays
              if (serviceTimings[3] === '=')
                serviceTimings[3] = serviceTimings[1];
              if (serviceTimings[4] === '=')
                serviceTimings[4] = serviceTimings[2];
              if (serviceTimings[5] === '=')
                serviceTimings[5] = serviceTimings[1];
              if (serviceTimings[6] === '=')
                serviceTimings[6] = serviceTimings[2];
              return serviceTimings;
            })
            .sort((a, b) => sortServices(a[0], b[0])),
        );

        const { pathname, search, hash } = location;
        gtag('config', window._GA_TRACKING_ID, {
          page_path: pathname + search + hash,
        });
      };
      window.onhashchange();
    });

    const setLeft = () => {
      const date = new Date();
      const time =
        `${date.getHours()}`.padStart(2, '0') +
        '' +
        `${date.getMinutes()}`.padStart(2, '0');
      const val = convertTimeToNumber(time);
      const left = (val / 24) * 100;
      setTimeLeft(left);

      let ampm = 'Am';
      let hour = date.getHours();
      if (hour > 12) {
        hour -= 12;
        ampm = 'PM';
      }
      const timeStr = (
        <>
          {hour}
          <blink>:</blink>
          {`${date.getMinutes()}`.padStart(2, '0')} {ampm}
        </>
      );
      setTimeStr(timeStr);
    };
    setLeft();
    setInterval(setLeft, 60 * 1000);
  }, []);

  return (
    <div>
      {!!data.length && <Ad />}
      <h1>
        Approximate first &amp; last bus arrival times&nbsp;for
        <br />
        <b>
          <span class="stop-tag">{stop || '     '}</span>{' '}
          {stopName ? stopName : <span class="placeholder">██████ ███</span>}
        </b>
      </h1>
      <p class="legend">
        <span>
          <span class="abbr">WD</span> Weekdays
        </span>
        <span>
          <span class="abbr">SAT</span> Saturdays
        </span>
        <span>
          <span class="abbr">SUN</span> Sundays &amp; Public Holidays
        </span>
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
              {!!data.length && !!timeLeft && !!timeStr && (
                <div
                  class="timerange-indicator"
                  style={{ left: `${timeLeft}%` }}
                >
                  <span>{timeStr}*</span>
                </div>
              )}
            </th>
          </tr>
        </thead>
        {data.length
          ? data.map((d, i) => {
              const [service, ...times] = d;
              const sameAsPrevService =
                data[i - 1] && service === data[i - 1][0];
              const [
                wd1raw,
                wd2raw,
                sat1raw,
                sat2raw,
                sun1raw,
                sun2raw,
              ] = times;
              const [wd1, wd2, sat1, sat2, sun1, sun2] = times.map(timeFormat);
              return (
                <tbody class={sameAsPrevService ? 'insignificant' : ''}>
                  <tr>
                    <td rowspan="3">{service}</td>
                    <th>
                      <abbr title="Weekdays">WD</abbr>
                    </th>
                    <td title={wd1raw}>{wd1}</td>
                    <td title={wd2raw}>{wd2}</td>
                    <td class="time-cell">
                      <TimeRanger values={[wd1raw, wd2raw]} />
                    </td>
                  </tr>
                  <tr>
                    <th>
                      <abbr title="Saturdays">SAT</abbr>
                    </th>
                    <td title={sat1raw}>{sat1}</td>
                    <td title={sat2raw}>{sat2}</td>
                    <td class="time-cell">
                      <TimeRanger values={[sat1raw, sat2raw]} />
                    </td>
                  </tr>
                  <tr>
                    <th>
                      <abbr title="Sundays &amp; Public Holidays">SUN</abbr>
                    </th>
                    <td title={sun1raw}>{sun1}</td>
                    <td title={sun2raw}>{sun2}</td>
                    <td class="time-cell">
                      <TimeRanger values={[sun1raw, sun2raw]} />
                    </td>
                  </tr>
                </tbody>
              );
            })
          : [1, 2, 3].map((v) => (
              <tbody key={v}>
                <tr>
                  <td rowspan="3">
                    <span class="placeholder">██</span>
                  </td>
                  <th>
                    <abbr title="Weekdays">WD</abbr>
                  </th>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td class="time-cell">
                    <TimeRanger />
                  </td>
                </tr>
                <tr>
                  <th>
                    <abbr title="Saturdays">SAT</abbr>
                  </th>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td class="time-cell">
                    <TimeRanger />
                  </td>
                </tr>
                <tr>
                  <th>
                    <abbr title="Sundays &amp; Public Holidays">SUN</abbr>
                  </th>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td class="time-cell">
                    <TimeRanger />
                  </td>
                </tr>
              </tbody>
            ))}
        <tfoot>
          <tr>
            <td colspan="5">
              <p>
                {data.length
                  ? `${data.length} service${data.length === 1 ? '' : 's'} · `
                  : ''}
                <a href="/">BusRouter SG</a>
              </p>
              <p class="timerange-note">
                <small>
                  <b>*</b> Current time based on your timezone, which may be
                  different than Singapore timezone.
                </small>
              </p>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const $firstlast = document.getElementById('firstlast');
render(<FirstLastTimes />, $firstlast);
