import { h, Fragment } from 'preact';
import { useRef } from 'preact/hooks';

import { getStopGridForNormalOrLoopRoute } from '../utils/routesCalculation';

function rowSpaner(stopGrid, column, stop) {
  if (!stop) return 1;
  let span = 1;
  let rowIndex = stopGrid.findIndex((pair) => pair[column] === stop);
  while (stopGrid[++rowIndex] && !stopGrid[rowIndex][column]) {
    // Indicate the column has been rowspan-ed
    stopGrid[rowIndex][column] = '___';
    span++;
  }
  return span;
}

export default function StopsList(props) {
  const { routes, stopsData, onStopClick, onStopClickAgain } = props;
  if (
    !routes ||
    !routes.length ||
    routes[0].length <= 1 ||
    (routes[1] && routes[1].length <= 1) ||
    !stopsData
  ) {
    console.warn('Invalid arguments');
    return null;
  }

  const [route1, route2] = routes;

  if (route1 && route2) {
    if (route1[0] === route2[0]) {
      console.warn('Both routes start from same point', route1[0]);
    }
    if (route1[route1.length - 1] === route2[route2.length - 1]) {
      console.warn('Both routes end at same point', route1[route1.length - 1]);
    }
    if (
      route1[route1.length - 1] === route2[0] &&
      route2[route2.length - 1] !== route1[0]
    ) {
      console.warn(
        'First route connects to the 2nd route. Why?',
        route1[route1.length - 1],
        route2[0],
        route2[route2.length - 1],
        route1[0],
      );
    }
  }

  const route1Len = route1.length;
  const route1FirstStop = route1[0];
  const route1LastStop = route1[route1Len - 1];

  const lastStop = useRef();

  const StopLink = ({ stop }) =>
    stop ? (
      <a
        href={`#/stops/${stop}`}
        data-stop={stop}
        onClick={(e) => {
          e.preventDefault();
          if (lastStop.current === stop && onStopClickAgain) {
            onStopClickAgain(stop);
          } else if (onStopClick) {
            onStopClick(stop);
          }
          lastStop.current = stop;
        }}
      >
        <b class="mini-stop-tag">{stop}</b>
        <br />
        {stopsData[stop].name}
      </a>
    ) : null;

  // Only 1 route & not a loop
  if (!route2 && route1FirstStop !== route1LastStop) {
    // Contains duplicates
    if (route1.some((val, i) => route1.indexOf(val) !== i)) {
      // Do nothing for now, this is very edge case
      console.info('Duplicate stops found on 1-way route.');
    }
    console.warn();
    return (
      <ol class="stops-list">
        {route1.map((s) => (
          <li>
            <StopLink stop={s} />
          </li>
        ))}
      </ol>
    );
  } else {
    let loopRoute = false; // A->A
    if (!route2) {
      // Mostly likely a loop route A⟲B
      // So, split route1 into two routes
      loopRoute = true;
    }

    // Complex table layout for complex routes yo
    const stopGrid = getStopGridForNormalOrLoopRoute(
      route1,
      route2,
      route1Len,
      loopRoute,
    );

    console.log({ route1, route2, stopGrid });

    const stopGridStops = stopGrid
      .flat()
      .filter((v) => /\d/.test(v))
      .filter((value, index, array) => array.indexOf(value) == index);
    const routeStops = [...route1, ...(route2 || [])].filter(
      (value, index, array) => array.indexOf(value) == index,
    );
    if (stopGridStops.length !== routeStops.length) {
      console.error('Some stops are missing!', stopGridStops, routeStops);
    }

    return (
      <table class="stops-table">
        <colgroup>
          <col class="stop" />
          <col class="middle" />
          <col class="stop" />
        </colgroup>
        {stopGrid.map(
          (
            [
              s1,
              s2,
              {
                isOpposite,
                col1IsEmpty,
                col2IsEmpty,
                col1FirstStop,
                col2FirstStop,
                col1LastStop,
                col2LastStop,
              },
            ],
            index,
          ) => {
            const isEdgeRows =
              (index === 0 || index === stopGrid.length - 1) && s1 === s2;
            return (
              <>
                {/*
                  Safari needs this empty row
                  Else the table will break for A->B,C->D routes
                  Which means tables without this td[colspan=3]
                */}
                {index === 0 && (
                  <tr>
                    <td colspan="3"></td>
                  </tr>
                )}
                <tr class={isEdgeRows ? 'edge' : ''}>
                  {isEdgeRows ? (
                    <td
                      class={`stop-${
                        s1 === '~~~' ? 'u' : index === 0 ? 'start' : 'end'
                      } ${loopRoute ? 'loop' : ''}`}
                      colspan="3"
                    >
                      {s1 !== '~~~' && <StopLink stop={s1} />}
                    </td>
                  ) : (
                    <>
                      {s1 ? (
                        s1 !== '___' && (
                          <td
                            class={`${col1IsEmpty ? '' : 'stop'} ${
                              col1FirstStop ? 'first' : ''
                            } ${col1LastStop ? 'last' : ''}`}
                            rowspan={
                              isOpposite ||
                              index === stopGrid.length - 1 ||
                              index === 0
                                ? 1
                                : rowSpaner(stopGrid, 0, s1)
                            }
                          >
                            <StopLink stop={s1} />
                          </td>
                        )
                      ) : (
                        <td class={col1IsEmpty ? '' : 'empty'} />
                      )}
                      <td class={isOpposite ? 'opposite' : ''} />
                      {s2 ? (
                        s2 !== '___' && (
                          <td
                            class={`${col2IsEmpty ? '' : 'stop'} ${
                              col2FirstStop ? 'first' : ''
                            } ${col2LastStop ? 'last' : ''}`}
                            rowspan={
                              isOpposite ||
                              index === stopGrid.length - 1 ||
                              index === 0
                                ? 1
                                : rowSpaner(stopGrid, 1, s2)
                            }
                          >
                            <StopLink stop={s2} />
                          </td>
                        )
                      ) : (
                        <td class={col2IsEmpty ? '' : 'empty'} />
                      )}
                    </>
                  )}
                </tr>
              </>
            );
          },
        )}
      </table>
    );
  }
  return null;
}
