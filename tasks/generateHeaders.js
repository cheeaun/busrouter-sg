const fs = require('fs');
const type = (filename) => {
  if (/\.css$/.test(filename)) return 'style';
  if (/\.js$/.test(filename)) return 'script';
  if (/\.(jpe?g|png|gif|svg)$/.test(filename)) return 'image';
};

const files = fs.readdirSync('dist');

const homeFiles = [
  /^app\..+js$/,
  /^app\..+css$/,
];

let content = '/*';

files.forEach(f => {
  if (homeFiles.some(r => r.test(f))){
    content += `\n  Link: </${f}>; rel=preload; as=${type(f)}`;
  }
});

const arrivalFiles = [
  /^arrival\..+js$/,
  /^arrival\..+css$/,
  /^stop\-active\..+svg$/,
  /^bus\-bendy\..+svg$/,
  /^bus\-double\..+svg$/,
  /^bus\-single\..+svg$/,
  /^wheelchair\..+svg$/,
];

content += '\n/bus-arrival/*';

files.forEach(f => {
  if (arrivalFiles.some(r => r.test(f))){
    content += `\n  Link: </${f}>; rel=preload; as=${type(f)}`;
  }
});

fs.writeFileSync('dist/_headers', content);