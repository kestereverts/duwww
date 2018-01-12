module.exports = {
  register: require('./register'),
  api: {
    auth: require('./api.auth'),
    up: require('./api.up'),
    hist: require('./api.hist')
  },
  viewfile: require('./viewfile')
}
