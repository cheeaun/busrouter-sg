// Bug: Cross Origin Resource Policy with Parcel
// https://github.com/parcel-bundler/parcel/issues/6561#issuecomment-878344133
module.exports = function (app) {
  app.use((req, res, next) => {
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    next();
  });
};
