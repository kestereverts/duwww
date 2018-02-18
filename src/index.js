const path = require('path')
const debug = require('debug')('duwww:index')
const os = require('os')
const human2bytes = require('human2bytes')
const db = require('./db')

;(async function () {
  debug(`Environment: ${process.env.NODE_ENV}`)
  if (!process.env.DB) {
    process.env.DB = path.resolve(os.homedir(), 'duwww.db')
  }
  process.env.DB = path.resolve(process.cwd(), process.env.DB)

  if (!process.env.UPLOAD_FOLDER) {
    process.env.UPLOAD_FOLDER = path.resolve(os.homedir(), 'duwww', 'uploads')
  }
  process.env.UPLOAD_FOLDER = path.resolve(process.cwd(), process.env.UPLOAD_FOLDER)

  if (process.env.MAX_FILE_SIZE) {
    process.env.MAX_FILE_SIZE = human2bytes(process.env.MAX_FILE_SIZE)
  } else {
    process.env.MAX_FILE_SIZE = 2 * 1024 * 1014
  }

  if (!process.env.URL_PREFIX) {
    process.env.URL_PREFIX = 'https://example.com/'
  }

  debug(`Database path: ${process.env.DB}`)
  debug(`Upload path: ${process.env.UPLOAD_FOLDER}`)
  debug(`Max file size: ${process.env.MAX_FILE_SIZE} bytes`)

  const app = require('./server')
  app.listen(process.env.SOCKET || 8080)

  if (process.setuid && process.env.RUN_AS) {
    process.setuid(process.env.RUN_AS)
    debug(`Running as: ${process.env.RUN_AS}`)
  }

  app.emit('droppedPrivileges')

  try {
    await db.loadDb()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
})()
