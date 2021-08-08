import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default function About() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const intro = localStorage.getItem('busroutersg.about');
      if (intro !== 'true') setHidden(false);
    } catch (e) {}

    const $logo = document.getElementById('logo');
    if ($logo) {
      $logo.onclick = (e) => {
        e.preventDefault();
        setHidden(!hidden);
      };
    }
  }, []);

  return (
    <div id="about" hidden={hidden} onClick={() => setHidden(true)}>
      <section onClick={(e) => e.stopPropagation()}>
        <h2>
          BusRouter SG
          <br />
          <small>Singapore Bus Routes Explorer</small>
        </h2>
        <p>
          Explore bus stops and routes on the map for all bus services in
          Singapore, with realtime bus arrival times and per-bus-stop passing
          routes overview.
        </p>
        <hr />
        <p>
          <a
            href="https://github.com/cheeaun/busrouter-sg"
            target="_blank"
            rel="noopener"
          >
            Built
          </a>{' '}
          &amp;{' '}
          <a href="/visualization/" target="_blank" rel="noopener">
            visualized
          </a>{' '}
          by{' '}
          <a href="http://twitter.com/cheeaun" target="_blank" rel="noopener">
            @cheeaun
          </a>
          . Data{' '}
          <a
            href="http://www.mytransport.sg/"
            target="_blank"
            rel="noopener"
            title="Land Transport Authority"
          >
            &copy; LTA
          </a>
          .
        </p>
        <p>
          Sister sites:{' '}
          <a href="https://railrouter.sg/" target="_blank" rel="noopener">
            🚆 RailRouter SG
          </a>{' '}
          <a href="https://taxirouter.sg/" target="_blank" rel="noopener">
            🚖 TaxiRouter SG
          </a>
        </p>
        <p>
          <a
            class="donation-box"
            href="https://www.buymeacoffee.com/cheeaun"
            target="_blank"
            rel="noopener"
          >
            ❤️ Liking BusRouter SG?
            <br />
            ☕️ Support my work & treat me a coffee!
          </a>
        </p>
        <div class="popover-buttons">
          <button
            class="popover-button"
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem('busroutersg.about', 'true');
              } catch (e) {}
            }}
          >
            Let's explore!
          </button>
        </div>
      </section>
    </div>
  );
}
