const util = require('util')
const crypto = require('crypto')

module.exports = util.promisify(crypto.randomBytes)
