const express = require('express')
const argon2 = require('argon2')
const middleware = require('./middleware')
const randomBytes = require('../randomBytes')

const router = express.Router()

router.get('/', middleware.registrationEnabled, (req, res) => {
  res.render('register')
})

router.post('/', middleware.registrationEnabled, middleware.db, express.json({type: 'json'}), async (req, res) => {
  try {
    if (req.body && typeof req.body.email === 'string' && typeof req.body.password === 'string') {
      const [hash, apiKey] = await Promise.all([
        argon2.hash(req.body.password, {
          type: argon2.argon2i
        }),
        randomBytes(30)])
      const apiKeyString = apiKey.toString('base64').replace(/\//g, '_').replace(/\+/g, '-')
      await req.db.run('INSERT INTO user (email, password, apiKey) VALUES(?, ?, ?)',
        req.body.email,
        hash,
        apiKeyString
      )
      if (req.body.disableRegistration === true) {
        process.env.REGISTER = '0'
      }
      res.json({success: true, apiKey: apiKeyString, disableRegistration: process.env.REGISTER !== '1'})
    } else {
      throw new Error('Invalid email or password')
    }
  } catch (e) {
    res.json({success: false, reason: e.message})
  }
})

module.exports = router
