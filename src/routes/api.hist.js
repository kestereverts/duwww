const express = require('express')

const router = express.Router()

router.post('/', (req, res, next) => {
  res.end('0\n')
})

module.exports = router
