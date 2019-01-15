let supportsGeolocation;
export default function checkGeolocationSupport(callback) {
  if (supportsGeolocation !== undefined) {
    callback(supportsGeolocation);
  } else if (window.navigator.permissions !== undefined) {
    // navigator.permissions has incomplete browser support
    // http://caniuse.com/#feat=permissions-api
    // Test for the case where a browser disables Geolocation because of an
    // insecure origin
    window.navigator.permissions.query({ name: 'geolocation' }).then((p) => {
      console.log('Geolocation permission', p.state);
      supportsGeolocation = p.state === 'denied' ? false : p.state;
      callback(supportsGeolocation);
    });
  } else {
    supportsGeolocation = !!window.navigator.geolocation;
    callback(supportsGeolocation);
  }
}