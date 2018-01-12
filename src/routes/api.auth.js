const express = require('express')
const argon2 = require('argon2')
const debug = require('debug')('duwww:api:auth')
const middleware = require('./middleware')

const router = express.Router()

router.post('/', express.urlencoded({extended: false}), middleware.db, async (req, res, next) => {
  try {
    res.type('text/plain')
    let user
    if (req.body) {
      if (typeof req.body.e === 'string' && typeof req.body.p === 'string') {
        user = await req.db.get(`
          SELECT user.*, SUM(upload.size) totalSize FROM user
          LEFT JOIN upload ON upload.owner = user.id
          WHERE user.enabled = 1 AND user.email = ?
          GROUP BY user.id
          `,
          req.body.e
        )
        if (user) {
          if (!await argon2.verify(user.password, req.body.p)) {
            user = void 0
          }
        }
      } else if (typeof req.body.k === 'string') {
        user = await req.db.get(`
          SELECT user.*, SUM(upload.size) totalSize FROM user
          LEFT JOIN upload ON upload.owner = user.id
          WHERE user.enabled = 1 AND user.apiKey = ?
          GROUP BY user.id
          `,
          req.body.k
        )
      } else {
        res.status(400).end('Invalid request')
        return
      }
    } else {
      res.status(400).end('Invalid request')
      return
    }

    if (user) {
      const totalSize = user.totalSize === null ? 0 : user.totalSize
      res.end(`1,${user.apiKey},,${totalSize}`)
    } else {
      debug('Invalid credentials')
      res.status(403).end('-1')
    }
  } catch (e) {
    next(e)
  }
})

module.exports = router
