export default () => {
  const path = location.hash.replace(/^#/, '') || '/';
  if (path === '/') return { page: 'home' };
  let [_, page, value, subpage] =
    path.match(/(service|stop|between)s?\/([^\/]+)\/?([^\/]+)?/) || [];
  return { page, value, path, subpage };
};
