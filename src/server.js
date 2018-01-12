const path = require('path')

const express = require('express')

const app = express()
app.set('x-powered-by', false)

app.on('droppedPrivileges', () => {
  app.set('views', path.resolve(__dirname, '..', 'views'))
  app.set('view engine', 'ejs')

  const routes = require('./routes')
  app.use('/register', routes.register)
  app.use('/api/auth', routes.api.auth)
  app.use('/api/up', routes.api.up)
  app.use('/api/hist', routes.api.hist)
  app.use('/', routes.viewfile)
})

module.exports = app
