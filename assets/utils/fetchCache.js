import lscache from 'lscache';

export default (url, timeout) => {
  const data = lscache.get(url);
  if (data) {
    return Promise.resolve(data);
  } else {
    return fetch(url).then(r => r.json()).then(r => {
      lscache.set(url, r, timeout);
      return r;
    });
  }
};