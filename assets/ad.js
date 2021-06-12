import { h } from 'preact';

export default () => {
  try {
    if (localStorage['busroutersg.noads'] === '1') {
      return '';
    }
  } catch (e) {}

  return <div id="bsa-zone_1623358681242-2_123456" style={{ backgroundColor: 'rgba(0,0,0,.03)' }} />;
};
