import { layers, namedFlavor } from '@protomaps/basemaps';

// Tile paths
const sgTilesPath = new URL('../tiles/singapore.pmtiles', import.meta.url);
const sgBuildingsTilesPath = new URL(
  '../tiles/singapore-buildings.pmtiles',
  import.meta.url,
);
const sgRailTilesPath = new URL('../tiles/sg-rail.geojson', import.meta.url);

const GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_URL =
  'https://protomaps.github.io/basemaps-assets/sprites/v4/light';

const COLORS = {
  lightBlue: '#bee8f9',
  beige: '#f8f8f3',
  honeydew: '#deecd5',
  white: '#fff',
  whitesmoke: '#f0f0ee',
  mistyrose: '#fcf3f2',
  lavender: '#e9eaf2',
  lightBrown: '#d5d1ca',
  lightYellow: '#e5e5d2',
  linen: '#fbf0ea',
};

// Customize Protomaps light theme
const currentFlavor = namedFlavor('light');
const flavor = {
  ...currentFlavor,
  background: COLORS.lightBlue,
  water: COLORS.lightBlue,
  earth: COLORS.beige,
  landcover: {
    ...currentFlavor.landcover,
    farmland: COLORS.honeydew,
    forest: COLORS.honeydew,
    grassland: COLORS.honeydew,
  },
  buildings: COLORS.whitesmoke,
  hospital: COLORS.mistyrose,
  park_a: COLORS.honeydew,
  park_b: COLORS.honeydew,
  wood_a: COLORS.honeydew,
  wood_b: COLORS.honeydew,
  scrub_a: COLORS.honeydew,
  scrub_b: COLORS.honeydew,
  aerodrome: COLORS.lavender,
  industrial: COLORS.beige,
  military: COLORS.beige,
  zoo: COLORS.honeydew,
  minor_a: COLORS.white,
  minor_service: COLORS.white,
  school: COLORS.linen,
  pedestrian: COLORS.beige,

  // walk paths
  other: COLORS.lightBrown,
  tunnel_other: COLORS.lightBrown,
  bridges_other: COLORS.lightBrown,

  tunnel_minor: COLORS.lightYellow,
  tunnel_link: COLORS.lightYellow,
  tunnel_major: COLORS.lightYellow,
  tunnel_highway: COLORS.lightYellow,

  bridges_major: COLORS.white,

  subplace_label_halo: COLORS.white,
  city_label_halo: COLORS.white,
  state_label_halo: COLORS.white,
};

export function createMapStyle({ lang = 'en' } = {}) {
  const mapLayers = layers('protomaps', flavor, {
    lang,
  });

  const customMapLayers = [];
  let poisLayer = null;

  for (const layer of mapLayers) {
    // Remove these layers
    if (['address_label', 'roads_rail'].includes(layer.id)) {
      continue;
    }

    // Modify layers based on their ID or pattern
    switch (layer.id) {
      // Replace buildings with Overture buildings
      case 'buildings':
        layer.filter = ['!=', ['get', 'is_underground'], true];
        layer.source = 'buildings';
        layer['source-layer'] = 'building';
        layer.paint['fill-outline-color'] = '#d7d7c7';
        layer.paint['fill-opacity'] = 1;
        layer.minzoom = 15;
        break;

      case 'places_subplace':
        layer.layout['text-font'] = ['Noto Sans Medium'];
        layer.paint['text-halo-width'] = 2;
        layer.minzoom = 10;
        break;

      case 'places_locality':
        layer.minzoom = 14;
        break;

      case 'pois':
        poisLayer = layer;
        layer.minzoom = 16;
        // Re-adjust the kind filters in pois
        const poisFilterKindsLiteral = layer.filter
          ?.find?.((v) => v[0] === 'in')
          ?.find((v) => v[0] === 'literal');
        const poisFilterKinds = poisFilterKindsLiteral?.[1];
        console.log('KINDS', layer.filter, poisFilterKinds);
        if (poisFilterKinds?.length) {
          poisFilterKindsLiteral[1] = [
            'aerodrome',
            'animal',
            // 'arrow',
            'beach',
            // 'bench',
            // 'bus_stop',
            'capital',
            // 'drinking_water',
            'ferry_terminal',
            'forest',
            'garden',
            'library',
            'marina',
            'park',
            'peak',
            'school',
            'stadium',
            // 'toilets',
            'townspot',
            // 'train_station',
            'university',
            'zoo',
          ];
        }
        break;
    }

    if (/(water|road).+label/i.test(layer.id)) {
      layer.minzoom = 16;
    }

    // Uppercase road labels
    if (/road.+label/i.test(layer.id)) {
      layer.layout['text-transform'] = 'uppercase';
    }

    // Make roads wider on higher zoom levels
    const ROAD_WIDTH_MAX = 20;
    const ROAD_LARGER_MULTIPLIER = 2;
    const ROAD_LARGEST_MULTIPLIER = 6;
    if (layer['source-layer'] === 'roads' && layer.type === 'line') {
      const isCasing = /casing/i.test(layer.id);
      const lineWidth = isCasing
        ? layer.paint['line-gap-width']
        : layer.paint['line-width'];
      const hasInterpolate = lineWidth?.[0] === 'interpolate';
      if (hasInterpolate) {
        const lastZoom = lineWidth[lineWidth.length - 2];
        const lastWidth = lineWidth[lineWidth.length - 1];
        const isMajor = /(major|highway)/i.test(layer.id);
        const largerWidth =
          lastWidth *
          (isMajor ? ROAD_LARGEST_MULTIPLIER : ROAD_LARGER_MULTIPLIER);
        if (lastZoom < ROAD_WIDTH_MAX) {
          lineWidth.push(ROAD_WIDTH_MAX, largerWidth);
        }
      }
    }

    // Add the layer to our custom array
    customMapLayers.push(layer);

    // Add buildings_label after pois
    if (layer.id === 'pois' && poisLayer) {
      customMapLayers.push({
        id: 'buildings_label',
        type: 'symbol',
        source: 'buildings',
        'source-layer': 'building',
        minzoom: 15,
        layout: {
          'text-field': ['get', '@name'],
          'text-font': ['Noto Sans Regular'],
          'text-max-width': 8,
          'text-size': poisLayer.layout['text-size'],
          'text-padding': 8,
        },
        paint: {
          ...poisLayer.paint,
          'text-color': currentFlavor.pois.slategray,
        },
      });
    }
  }

  console.log(
    'LAYERS',
    customMapLayers.map((l) => l.id),
  );

  const mapStyle = {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_URL,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${sgTilesPath}`,
        attribution:
          '<a href="https://protomaps.com" target="_blank">Protomaps</a> © <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a>',
      },
      buildings: {
        type: 'vector',
        url: `pmtiles://${sgBuildingsTilesPath}`,
        // Don't need OSM because already covered by the one above
        attribution:
          '<a href="https://overturemaps.org" target="_blank">Overture Maps Foundation</a>',
      },
      'sg-rail': {
        type: 'geojson',
        data: sgRailTilesPath.href,
        attribution:
          '© <a href="https://www.smrt.com.sg/" target="_blank" title="Singapore Mass Rapid Transit">SMRT</a> © <a href="https://www.sbstransit.com.sg/" target="_blank" title="Singapore Bus Services">SBS</a>',
      },
    },
    layers: customMapLayers,
  };

  return mapStyle;
}

export { sgRailTilesPath };
