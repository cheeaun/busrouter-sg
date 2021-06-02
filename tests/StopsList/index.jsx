import '../../assets/app.css';

import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

import StopsList from '../../assets/components/StopsList';
import { sortServices } from '../../assets/utils/bus';

function App() {
  if (location.hash === '#all') {
    const [stopsData, setStopsData] = useState(null);
    const [servicesData, setServicesData] = useState(null);

    const countPerPage = 50;
    const [page, _setPage] = useState(1);
    const setPage = (...args) => {
      console.clear();
      _setPage(...args);
    };

    useEffect(() => {
      fetch('https://data.busrouter.sg/v1/stops.min.json')
        .then((d) => d.json())
        .then((d) => {
          const data = {};
          Object.entries(d).forEach(([id, d]) => {
            data[id] = { name: d[2] };
          });
          setStopsData(data);
        });
      fetch('https://data.busrouter.sg/v1/services.min.json')
        .then((d) => d.json())
        .then((d) => setServicesData(d));
    }, []);

    if (stopsData && servicesData) {
      const services = Object.entries(servicesData).sort((a, b) =>
        sortServices(a[0], b[0]),
      );
      const totalPages = Math.ceil(services.length / countPerPage);
      return (
        <>
          <h1>All {services.length} bus routes in Singapore</h1>
          <p>
            <button class="link" onClick={() => setPage(Math.max(1, page - 1))}>
              ⬅️
            </button>
            {Array(totalPages)
              .fill(0)
              .map((v, i) => (
                <button class="link" onClick={() => setPage(i + 1)}>
                  {i === page - 1 ? <b>{i + 1}</b> : i + 1}
                </button>
              ))}
            <button
              class="link"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
            >
              ➡️
            </button>
          </p>
          <div id="tests" class="large">
            {services
              .slice((page - 1) * countPerPage, page * countPerPage)
              .map(([id, d]) => {
                console.log(`🚌 ${id}`);
                const el = StopsList({ routes: d.routes, stopsData });
                if (!el) {
                  console.log(id, d.routes);
                  debugger;
                  return;
                }
                return (
                  <div class="test">
                    <h2>
                      {id} {d.name}
                    </h2>
                    <div class="slot">{el}</div>
                  </div>
                );
              })}
          </div>
        </>
      );
    }

    return null;
  }

  const stopsData = new Proxy(
    {},
    {
      get: (target, prop, receiver) => {
        return {
          name: `Stop ${prop}`,
        };
      },
    },
  );

  const tests = [
    // Invalid cases
    [['11']],
    [['11'], ['21']],
    [['11', '21'], ['31']],
    [
      ['11', '21'],
      ['11', '41'],
    ],
    [
      ['11', '21'],
      ['31', '21'],
    ],
    [
      ['11', '21'],
      ['21', '31'],
    ],
    // A->A
    [['11', '11']],
    [['11', '21', '11']],
    [['11', '21', '31', '11']],
    [['11', '21', '31', '41', '11']],
    [['11', '21', '31', '29', '11']],
    [['11', '21', '29', '41', '11']],
    [['11', '49', '21', '31', '41', '11']],
    [['11', '49', '21', '51', '31', '41', '61', '11']],
    [['11', '49', '21', '51', '31', '55', '29', '41', '61', '71', '11']],
    // A->B
    [['11', '21']],
    [['11', '21', '31']],
    [['11', '21', '31', '41']],
    // A->B, C->D
    [
      ['11', '21'],
      ['31', '41'],
    ],
    [
      ['11', '21', '31'],
      ['41', '51', '61'],
    ],
    [
      ['11', '31'],
      ['41', '51', '61'],
    ],
    [
      ['11', '21', '31'],
      ['41', '61'],
    ],
    [
      ['11', '81', '31'],
      ['41', '51', '61', '71'],
    ],
    [
      ['11', '81', '91', '31'],
      ['111', '121', '131', '141', '151', '161'],
    ],
    [
      ['111', '181', '191', '131'],
      ['11', '21', '31', '41', '51', '61', '71', '81'],
    ],
    [
      ['69', '81', '11', '59', '41', '31'],
      ['51', '21', '19', '61', '71', '91'],
    ],
    // A->B, B->A
    [
      ['11', '21'],
      ['21', '11'],
    ],
    [
      ['11', '31', '21'],
      ['21', '11'],
    ],
    [
      ['11', '31', '41', '21'],
      ['21', '51', '11'],
    ],
    [
      ['11', '31', '41', '21'],
      ['21', '51', '49', '11'],
    ],
    [['11', '21', '19', '11']],
    [['11', '19', '21', '11']],
  ];

  return (
    <>
      <h1>Routes Tests</h1>
      <p>
        List of routes shown with stops (e.g.: 11 → 21 → 31) and their rendered
        routes. Stop numbers are minimum two digits with last number indicating
        stops with opposite-direction services.
      </p>
      <div id="tests">
        {tests.map((routes, i) => {
          console.log(i + 1);
          const el = StopsList({ key: i, routes, stopsData });
          return (
            <div class="test">
              <h2 class="small">{i + 1}</h2>
              <ol>
                {routes.map((r) => (
                  <li>{r.join(' → ')}</li>
                ))}
              </ol>
              <div class="slot">
                {el || (
                  <i class="nada">Nothing rendered due to invalid parameters</i>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

render(<App />, document.getElementById('app'));
