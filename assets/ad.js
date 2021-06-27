import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';

export default () => {
  try {
    if (localStorage['busroutersg.noads'] === '1') {
      return '';
    }
  } catch (e) {}

  const adRef = useRef();

  useEffect(() => {
    if (adRef.current?.offsetWidth > 0 && adRef.current?.offsetHeight > 0) {
      // Only push if the ad slot is visible
      adRef.current?.id = 'bsa-zone_1623358681242-2_123456';
      window.optimize = window.optimize || { queue: [] };
      window.optimize.queue.push(() => {
        window.optimize.pushAll();
      });
    }
  }, []);

  const showFake = location.hostname === 'localhost';

  return (
    <div
      ref={adRef}
      class="ads"
      style={
        showFake
          ? {
              backgroundColor: 'rgba(0,0,0,.03)',
              textAlign: 'center',
              minHeight: 160,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontWeight: 'bold',
              color: 'gray',
            }
          : { backgroundColor: 'rgba(0,0,0,.03)', textAlign: 'center' }
      }
    >
      {showFake && 'AD'}
    </div>
  );
};
