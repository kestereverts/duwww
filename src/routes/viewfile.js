const express = require('express')
const debug = require('debug')('duwww:viewfile')
const middleware = require('./middleware')
const path = require('path')
const base62 = require('../base62')
const mime = require('mime')
const fs = require('fs-extra')

const router = express.Router()

function route (route) {
  if (route === '/') route = ''
  return `/:id${route}`
}

function fixedEncodeURIComponent (str) {
  return encodeURIComponent(str).replace(/[!'()*]/gu, (c) => {
    return `%${c.charCodeAt(0).toString(16)}`
  })
}
const idRegExp = /^[A-Za-z0-9]{4}$/u
const idEmojiRegExp = new RegExp(`^[${base62.base62EmojiTable}]{4}$`, 'u')

router.get(route('/translate'), (req, res, next) => {
  try {
    res.type('text/plain; charset=utf-8')
    if (idRegExp.test(req.params.id)) {
      res.end(base62.encode.emoji(base62.decode(req.params.id)))
    } else if (idEmojiRegExp.test(req.params.id)) {
      res.end(base62.encode(base62.decode.emoji(req.params.id)))
    } else {
      next('route')
    }
  } catch (e) {
    next(e)
  }
})

// router.get(new RegExp(`${}`))

router.get(route('/'), middleware.db, middleware.findUpload, async (req, res, next) => {
  try {
    if (!req.upload) {
      debug('Upload not found in db or invalid id.')
      next('route')
      return
    }

    if (typeof req.upload.ttl === 'number') {
      if ((Date.now() - req.upload.timestamp) / 1000 > req.upload.ttl) {
        debug('Upload has to be deleted because time to live expired.')
        try {
          await fs.unlink(path.join(process.env.UPLOAD_FOLDER, 'finished') + '/' + req.upload.location)
          await req.db.run(`
            DELETE FROM upload WHERE id = $id
            `, {
              $id: req.upload.id
            }
          )
          debug('File deleted.')
          next('route')
          return
        } catch (e) {
          debug(e)
        }
      }
    }

    let contentType = req.upload.mediaType
    if (typeof contentType !== 'string') {
      if (req.upload.isBinary === null || req.upload.isBinary === 0) {
        contentType = 'text/plain'
      } else {
        contentType = 'application/octet-stream'
      }
    }

    let downloadFileName
    if (typeof req.upload.processedOriginalName === 'string') {
      downloadFileName = req.upload.processedOriginalName
    } else {
      downloadFileName = req.params.id
      if (typeof req.upload.mediaType === 'string') {
        const extension = mime.getExtension(req.upload.mediaType)
        if (typeof extension === 'string') {
          downloadFileName += `.${extension}`
        }
      }
    }

    const options = {
      root: path.join(process.env.UPLOAD_FOLDER, 'finished'),
      dotfiles: 'deny',
      maxAge: '1000 days',
      lastModified: true,
      acceptRanges: true,
      cacheControl: true,
      immutable: true,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=utf-8''${fixedEncodeURIComponent(downloadFileName)}`
      }
    }

    res.sendFile(req.upload.location, options, (err) => {
      if (err) {
        debug(err)
        next(err)
      } else {
        debug('File has been served.')
      }
    })
  } catch (e) {
    next(e)
  }
})

module.exports = router
