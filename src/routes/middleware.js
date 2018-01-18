const EventEmitter = require('events')
const path = require('path')
const Busboy = require('busboy')
const is = require('type-is')
const fs = require('fs-extra')
const db = require('../db')
const randomBytes = require('../randomBytes')
const debugU = require('debug')('duwww:middleware:upload')
const debugF = require('debug')('duwww:middleware:findUpload')
const base62 = require('../base62')

async function withDb (req, res, next) {
  try {
    req.db = await db.handle()
    next()
  } catch (e) {
    next(e)
  }
}

function registrationEnabled (req, res, next) {
  if (process.env.REGISTER === '1') {
    next()
  } else {
    next('route')
  }
}

async function user (req, res, next) {
  if (!req.db) {
    next(new Error('middleware.db must run before middleware.user'))
  }
  try {
    if (req.body && typeof req.body.k === 'string') {
      req.user = await req.db.get(`
        SELECT * FROM user
        WHERE enabled = 1 AND apiKey = ?
      `, req.body.k)
    }
    next()
  } catch (e) {
    next(e)
  }
}

const idRegExp = /^[A-Za-z0-9]{4}$/u
const idEmojiRegExp = new RegExp(`^[${base62.base62EmojiTable}]{4}$`, 'u')
async function findUpload (req, res, next) {
  try {
    if (!req.params.id) {
      next()
      return
    }
    debugF(`id is ${req.params.id}`)

    if (idEmojiRegExp.test(req.params.id)) {
      req.params.emojiId = req.params.id
      req.params.id = base62.encode(base62.decode.emoji(req.params.id))
      debugF(`id is translated to ${req.params.id}`)
    } else {
      debugF('id is not in emoji')
    }

    if (!idRegExp.test(req.params.id)) {
      next()
      return
    }
    if (!req.db) {
      next(new Error('middleware.db must run before middleware.findUpload'))
      return
    }

    req.upload = await req.db.get(`
      SELECT * FROM upload
      WHERE enabled = 1 AND id = ?
    `, base62.decode(req.params.id))
    next()
  } catch (e) {
    require('debug')('duwww:middleware:findUpload')(e)
    next(e)
  }
}

class File extends EventEmitter {
  constructor (stream, fieldname, filename, transferEncoding, mimeType, uploadDir) {
    super()
    this.stream = stream
    this.fieldname = fieldname
    this.filename = filename
    this.transferEncoding = transferEncoding
    this.mimeType = mimeType
    this.uploadDir = uploadDir
    this.abortFlag = false
    this.truncated = false
  }

  async save () {
    let fd
    for (let i = 0; i < 3; i++) {
      const filename = (await randomBytes(16)).toString('hex')
      this.filePath = path.join(this.uploadDir, filename)
      await fs.ensureDir(this.uploadDir)
      try {
        fd = await fs.open(this.filePath, 'wx')
        break
      } catch (e) {
        debugU(`An error (attempt #${i + 1}) occurred while trying to write to file ${this.filePath}: ${e}`)
      }
    }
    if (!fd) {
      debugU('Could not open file for writing')
      this.abort()
      return
    }

    this.writeStream = fs.createWriteStream(null, {fd})

    this.writeStream.on('error', (e) => {
      debugU(e)
      if (!this.abortFlag) this.abort()
    })

    this.writeStream.on('close', () => {
      debugU('File has been written')
      if (this.stream.truncated) {
        debugU('File was truncated')
        this.truncated = true
        if (!this.abortFlag) this.abort()
        return
      }
      if (!this.abortFlag) {
        this.emit('finish', this.writeStream.bytesWritten)
      }
    })

    this.stream.on('error', (e) => {
      debugU(e)
      if (!this.abortFlag) this.abort()
    })

    this.stream.pipe(this.writeStream)

    if (this.abortFlag) {
      this.abort()
    }
  }

  async abort () {
    debugU('Abort.')
    this.abortFlag = true
    try {
      if (this.writeStream) {
        this.stream.unpipe(this.writeStream)
        this.writeStream.end()
      }
    } catch (e) {
      debugU(e)
    }
    this.unlink()

    try {
      this.stream.resume()
    } catch (e) {
      debugU(e)
    }
    this.emit('abort')
  }

  async unlink () {
    if (this.filePath) {
      try {
        await fs.unlink(this.filePath)
      } catch (e) {
        debugU(e)
      }
    }
  }

  async move (destDir) {
    let moved = false
    let lastError
    for (let i = 0; i < 5; i++) {
      try {
        const filename = (await randomBytes(16)).toString('hex')
        const destFilePath = path.join(destDir, filename)
        await fs.move(this.filePath, destFilePath)
        this.filePath = destFilePath
        moved = true
        debugU('File has been moved.')
        break
      } catch (e) {
        lastError = e
        debugU(`An error (attempt #${i + 1}) occurred while trying to write to file ${this.filePath}: ${e}`)
      }
    }
    if (!moved) {
      throw lastError
    }
  }
}

function handlePuushUpload (options) {
  return function (req, res, next) {
    let hasNexted = false

    function pass (err) {
      if (!hasNexted) {
        hasNexted = true
        next(err)
      }
    }

    req.body = Object.create(null)

    if (!is(req, ['multipart'])) {
      debugU('Not a multipart form')
      pass()
      return
    }
    const busboy = new Busboy({
      headers: req.headers,
      limits: {
        fields: 10,
        fileSize: parseInt(process.env.MAX_FILE_SIZE),
        files: 1
      }
    })

    busboy.on('field', (fieldname, value) => {
      if (!hasNexted) {
        req.body[fieldname] = value
      } else {
        debugU(`Field ${fieldname} with value ${value} was encountered *after* the file in the multipart data`)
      }
    })

    busboy.on('file', (fieldname, stream, filename, transferEncoding, mimeType) => {
      if (fieldname !== options.fileField) {
        stream.resume()
        debugU('Fieldname is incorrect')
        pass()
        return
      }

      req.file = new File(stream, fieldname, filename, transferEncoding, mimeType, options.uploadDir)
      req.file.on('abort', () => {
        req.unpipe(busboy)
        busboy.removeAllListeners()
        try {
          // can't do this due to busboy bug
          // busboy.end()
        } catch (e) {
          debugU(e)
        }
        try {
          req.resume()
        } catch (e) {
          debugU(e)
        }
        pass()
      })

      debugU('File found. Calling pass()')
      pass()
    })

    busboy.on('error', (e) => {
      debugU(e)
      if (req.file) {
        req.file.abort()
      } else {
        req.unpipe(busboy)
        busboy.removeAllListeners()
        try {
          // can't do this due to busboy bug
          // busboy.end()
        } catch (e) {
          debugU(e)
        }
        try {
          req.resume()
        } catch (e) {
          debugU(e)
        }
        pass()
      }
    })

    busboy.on('finish', () => {
      debugU('Busboy is finished')
      pass()
    })

    req.on('error', (e) => {
      debugU(e)
    })
    req.pipe(busboy)
  }
}

module.exports = {
  db: withDb,
  registrationEnabled,
  user,
  upload: handlePuushUpload,
  findUpload
}
