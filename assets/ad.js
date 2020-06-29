import { h } from 'preact';
import { useEffect } from 'preact/hooks';

export default () => {
  try {
    if (localStorage['busroutersg.noads'] === '1') {
      return '';
    }
  } catch (e) {}

  useEffect(() => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
  }, []);

  return (
    <div class="ads" style={{ backgroundColor: 'rgba(0,0,0,.03)' }}>
      <ins
        class="adsbygoogle"
        style="display:block"
        data-ad-format="fluid"
        data-ad-layout-key="-h4-m+2v-17-3x"
        data-ad-client="ca-pub-8340907459180191"
        data-ad-slot="1187651175"
      />
    </div>
  );
};
