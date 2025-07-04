const fs = require('fs');
const type = (filename) => {
  if (/\.css$/.test(filename)) return 'style';
  if (/\.js$/.test(filename)) return 'script';
  if (/\.(jpe?g|png|gif|svg)$/.test(filename)) return 'image';
};

const files = fs.readdirSync('dist');

const headers = [
  {
    path: '/',
    files: [/^app\..+js$/, /^app\..+css$/],
  },
  {
    path: '/bus-arrival/',
    files: [
      /^arrival\..+js$/,
      /^arrival\..+css$/,
      /^stop\-active\..+svg$/,
      /^bus\-bendy\..+svg$/,
      /^bus\-double\..+svg$/,
      /^bus\-single\..+svg$/,
      /^wheelchair\..+svg$/,
    ],
  },
  {
    path: '/bus-first-last/',
    files: [/^firstlast\..+js$/, /^firstlast\..+css$/],
  },
  {
    path: '/visualization/',
    files: [/^visualization\..+js$/],
  },
];

let content = '';
headers.forEach((h) => {
  content += h.path + '\n';
  files.forEach((f) => {
    if (h.files.some((r) => r.test(f))) {
      content += `  Link: </${f}>; rel=preload; as=${type(f)}\n`;
    }
  });
});

// Headers for PMTiles, 1 week
content += `
/*.pmtiles
  Cache-Control: public, max-age=604800
`;

fs.writeFileSync('dist/_headers', content);
