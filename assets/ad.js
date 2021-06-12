import { h } from 'preact';
import { useEffect } from 'preact/hooks';

export default () => {
  try {
    if (localStorage['busroutersg.noads'] === '1') {
      return '';
    }
  } catch (e) {}

  useEffect(() => {
    window.optimize = window.optimize || { queue: [] };
    window.optimize.pushAll();
  }, []);

  return <div id="bsa-zone_1623358681242-2_123456" style={{ backgroundColor: 'rgba(0,0,0,.03)' }} />;
};
