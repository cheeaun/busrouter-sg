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

const findLoopHalfpoint = (route1, route1Len) => {
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

  return [half, hasMidStop, hasDupStops];
};

const copyRouteOrDivideAndCopyLoopRoute = (route1, route2, route1Len) => {
  // Create mutable copies
  let route1Copy, route2Copy;
  if (route2) {
    route1Copy = route1.slice();
    route2Copy = route2.slice().reverse(); // Reverse for easier index reference
  } else {
    // Mostly likely a loop route A⟲B
    // So, split route1 into two routes
    // loopRoute = true;

    const [half, hasMidStop, hasDupStops] = findLoopHalfpoint(
      route1,
      route1Len,
    );

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

  return [route1Copy, route2Copy];
};

export const getStopGridForNormalOrLoopRoute = (
  route1,
  route2,
  route1Len,
  loopRoute,
) => {
  const stopGrid = [];

  const [route1Copy, route2Copy] = copyRouteOrDivideAndCopyLoopRoute(
    route1,
    route2,
    route1Len,
  );

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

  return stopGrid;
};

export const getGeometriesForLoop = (
  serviceStops,
  geometries,
  stopsData,
  ruler,
) => {
  const loopStops = serviceStops[0];
  const loopGeometries = geometries[0];

  const [half, hasMidStop] = findLoopHalfpoint(loopStops, loopStops.length);

  let midStopCoordinate;
  if (hasMidStop) {
    const midStop = loopStops[half];

    midStopCoordinate = stopsData[midStop].coordinates;
  } else {
    const lastStopOfFirstHalfOfLoop = loopStops[half - 1];
    const firstStopOfSecondHalfOfLoop = loopStops[half];

    const lastStopFirstHalfCoordinates =
      stopsData[lastStopOfFirstHalfOfLoop].coordinates;
    const firstStopSecondHalfCoordinates =
      stopsData[firstStopOfSecondHalfOfLoop].coordinates;

    const middleSegment = ruler.lineSlice(
      lastStopFirstHalfCoordinates,
      firstStopSecondHalfCoordinates,
      loopGeometries.coordinates,
    );

    const middleSegmentLength = ruler.lineDistance(middleSegment);

    midStopCoordinate = ruler.along(middleSegment, middleSegmentLength / 2);
  }

  const { point: interpolatedCoordinate, index: interpolationSegmentIndex } =
    ruler.pointOnLine(loopGeometries.coordinates, midStopCoordinate);

  const newGeometries = [loopGeometries, loopGeometries];
  const splittedNewGeometries = newGeometries.map(
    ({ type, coordinates }, index) =>
      !index
        ? {
            type,
            coordinates: [
              ...coordinates.slice(0, interpolationSegmentIndex + 1),
              interpolatedCoordinate,
            ],
          }
        : {
            type,
            coordinates: [
              interpolatedCoordinate,
              ...coordinates.slice(interpolationSegmentIndex + 1),
            ],
          },
  );

  return splittedNewGeometries;
};
