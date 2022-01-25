import { h, Fragment } from 'preact';
import { useRef } from 'preact/hooks';

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

function isOpposite(stop) {
  return /[19]$/.test(stop);
}

function getOpposite(stop) {
  if (isOpposite(stop)) {
    return stop.replace(/[19]$/, (d) => (d === '1' ? 9 : 1));
  }
  return null;
}

function areOpposite(stop1, stop2) {
  if (!stop1 || !stop2) return false;
  return stop1 !== stop2 && stop1 === getOpposite(stop2);
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
    // Complex table layout for complex routes yo
    const stopGrid = [];

    // Create mutable copies
    let route1Copy, route2Copy;
    let loopRoute = false; // A->A
    if (route2) {
      route1Copy = route1.slice();
      route2Copy = route2.slice().reverse(); // Reverse for easier index reference
    } else {
      // Mostly likely a loop route A⟲B
      // So, split route1 into two routes
      loopRoute = true;
      let half;
      let hasMidStop = false;

      const hasDupStops = [];
      for (let i = 1, j = route1Len - 2; route1Len > 3 && !half; i++, j--) {
        const stop = route1[i];
        // console.log(i, j, route1, 1, stop);

        if (isOpposite(stop)) {
          // WEIRD CASE: the route has duplicate stops!
          // Don't check first item because last item is its duplicate in loop route
          if (i !== route1.lastIndexOf(stop)) {
            // TODO: Handle this usecase?
            // Do nothing for now
            hasDupStops.push(stop);
          } else {
            // Normal case, let's find the middle index
            const opStop = getOpposite(route1[i]);
            const index = route1.lastIndexOf(opStop);
            if (index > 0) j = index;
          }
        }
        if (i === j - 1) {
          half = j;
        } else if (i === j) {
          half = j;
          hasMidStop = true;
        }
      }

      if (hasDupStops.length) {
        console.info('This loop route has duplicate stops.', hasDupStops);
      }

      route1Copy = route1.slice(0, half);
      route2Copy = route1
        .slice(-(route1Len - half - (hasMidStop ? 1 : 0)))
        .reverse();
      // console.log('x', half, route1, route1Copy, route2Copy);

      /*
      const half = Math.floor(route1Len / 2);
      route1Copy = route1.slice(0, half);
      route2Copy = route1.slice(-half).reverse();
      */

      if (hasMidStop) {
        // Odd
        const midStop = route1[half];
        console.log({ midStop });
        if (areOpposite(midStop, route1[half - 1])) {
          // ~~~ = Dummy stop to connect at the end
          route2Copy.push(midStop, '~~~');
          route1Copy.push('~~~');
        } else if (areOpposite(midStop, route1[half + 1])) {
          route1Copy.push(midStop, '~~~');
          route2Copy.push('~~~');
        } else {
          // Throw in both because it'll be merged and rendered as a single stop later
          route1Copy.push(midStop);
          route2Copy.push(midStop);
        }
      } else {
        // Even
        route1Copy.push('~~~');
        route2Copy.push('~~~');
      }
    }
    console.log({
      route1Copy: route1Copy.slice(),
      route2Copy: route2Copy.slice(),
    });

    // const oppositeStops = [];
    // route1Copy.forEach((s, i) => {
    //   const opS = getOpposite(s);
    //   if (opS) {
    //     if (
    //       route2Copy.includes(opS) &&
    //       !route1Copy.includes(opS) &&
    //       !route2Copy.includes(s)
    //     ) {
    //       oppositeStops.push(s, opS);
    //     }
    //   }
    // });

    let i = 0;
    const maxLoopCount = route1Copy.length + route2Copy.length;
    let col1IsEmpty = true,
      col2IsEmpty = true;
    let col1FirstStop = false,
      col2FirstStop = false,
      col1LastStop = false,
      col2LastStop = false;
    do {
      const stop1HasOpposite = route2Copy.includes(getOpposite(route1Copy[0]));
      const stop2HasOpposite = route1Copy.includes(getOpposite(route2Copy[0]));
      const stop1IsLast = route1Copy.length === 1 || !route1Copy.length;
      const stop2IsLast = route2Copy.length === 1 || !route2Copy.length;

      if (loopRoute && i === 0) {
        stopGrid[i] = [route1Copy.shift(), route2Copy.shift()];
      } else if (
        (stop1HasOpposite && !stop2HasOpposite) ||
        (stop1IsLast && !stop1HasOpposite && !stop2IsLast && !stop2HasOpposite)
      ) {
        stopGrid[i] = [null, route2Copy.shift()];
      } else if (
        (!stop1HasOpposite && stop2HasOpposite) ||
        (stop2IsLast && !stop2HasOpposite && !stop1IsLast && !stop1HasOpposite)
      ) {
        stopGrid[i] = [route1Copy.shift(), null];
      } else {
        stopGrid[i] = [route1Copy.shift(), route2Copy.shift()];
      }

      // Check empty columns
      if (stopGrid[i]?.[0] && col1IsEmpty) {
        col1IsEmpty = false;
      } else if (!stopGrid[i]?.[0] && !route1Copy.length) {
        col1IsEmpty = true;
      }
      if (stopGrid[i]?.[1] && col2IsEmpty) {
        col2IsEmpty = false;
      } else if (!stopGrid[i]?.[1] && !route2Copy.length) {
        col2IsEmpty = true;
      }

      // Extra metadata
      const metadata = {
        isOpposite: areOpposite(stopGrid[i][0], stopGrid[i][1]),
        col1IsEmpty,
        col2IsEmpty,
      };

      // Check first/last stops
      if (stopGrid[i]?.[0] && !col1FirstStop) {
        metadata.col1FirstStop = col1FirstStop = true;
      }
      if (stopGrid[i]?.[1] && !col2FirstStop) {
        metadata.col2FirstStop = col2FirstStop = true;
      }
      if (!route1Copy.length && !col1LastStop) {
        metadata.col1LastStop = col1LastStop = true;
      }
      if (!route2Copy.length && !col2LastStop) {
        metadata.col2LastStop = col2LastStop = true;
      }

      // Final metadata push
      stopGrid[i]?.push(metadata);

      // Infinite loop guard
      if (i > maxLoopCount + 2) {
        console.error(
          'Something is wrong. Might be infinite loop',
          i,
          route1Copy,
          route2Copy,
          stopGrid,
        );
        return null;
      }
      i++;
    } while (route1Copy[0] || route2Copy[0]);

    // Postfix for loop routes (A->A)
    if (loopRoute) {
      const lastRow = stopGrid[stopGrid.length - 1];
      const last2ndRow = stopGrid[stopGrid.length - 2];
      if (lastRow[0] === lastRow[1] && last2ndRow?.includes(null)) {
        const [s1, s2, meta] = last2ndRow;
        if (lastRow[0] === '~~~') {
          const theStop = /\d/.test(s1) ? s1 : s2;
          stopGrid[stopGrid.length - 2] = [
            theStop,
            theStop,
            {
              ...meta,
              col1LastStop: true,
              col2LastStop: true,
            },
          ];
          stopGrid.pop();
        } else if (lastRow[0]) {
          if (!s1) last2ndRow[0] = lastRow[0];
          if (!s2) last2ndRow[1] = lastRow[0];
          if (!s1 || !s2) {
            stopGrid[stopGrid.length - 1] = [
              '~~~',
              '~~~',
              {
                col1LastStop: true,
                col2LastStop: true,
              },
            ];
          }
        }
      }
    }

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
