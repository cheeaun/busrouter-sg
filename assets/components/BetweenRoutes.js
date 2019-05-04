import { h } from 'preact';

export default function BetweenRoutes(props) {
  const { results, nearbyStart, nearbyEnd, onClickRoute } = props;
  if (!results.length) {
    return (<div class="between-block between-nada">😔 No routes available.</div>);
  }
  return (
    <div class="between-block">
      {results.map(result => {
        const { stopsBetween } = result;
        return (
          <div class={`between-item ${nearbyStart ? 'nearby-start' : ''}  ${nearbyEnd ? 'nearby-end' : ''}`} onClick={(e) => onClickRoute(e, result)}>
            <div class="between-inner">
              <div class={`between-services ${result.endService ? '' : 'full'}`}>
                <span class="start">{result.startService}</span>
                {!!result.endService && <span class="end">{result.endService}</span>}
              </div>
              <div class={`between-stops ${stopsBetween.length ? '' : 'nada'}`}>
                {result.startStop && <span class="start">{result.startStop.number}</span>}
                <span class={`betweens betweens-${Math.min(6, stopsBetween.length)}`}>
                  {!!stopsBetween.length && (
                    stopsBetween.length === 1 ? stopsBetween[0] : `${stopsBetween.length} stops`
                  )}
                </span>
                {result.endStop && <span class="end">{result.endStop.number}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};