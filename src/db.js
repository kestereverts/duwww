const path = require('path')
const sqlite = require('sqlite')

let resolveDbPromise
let rejectDbPromise
const dbPromise = new Promise((resolve, reject) => {
  resolveDbPromise = resolve
  rejectDbPromise = reject
})

async function loadDb () {
  try {
    const db = await sqlite.open(process.env.DB)
    await db.migrate({
      migrationsPath: path.resolve(__dirname, '..', 'migrations'),
      force: process.env.NODE_ENV === 'development' ? 'last' : false
    })
    resolveDbPromise(db)
  } catch (e) {
    rejectDbPromise(e)
    throw e
  }
}

function handle () {
  return dbPromise
}

module.exports = {
  handle,
  loadDb
}
