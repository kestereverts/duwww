const express = require('express')
const middleware = require('./middleware')
const path = require('path')
const base62 = require('../base62')
const debug = require('debug')('duwww:api:up')
const randomBytes = require('../randomBytes')
const mime = require('mime')
const readChunk = require('read-chunk')
const fileType = require('file-type')
const md5File = require('md5-file/promise')
const isBinaryFile = require('../isbinaryfile')

const router = express.Router()

async function randomId () {
  let value
  do {
    value = (await randomBytes(4)).readUInt32BE(0, true) & 0xFFFFFF
  } while (value >= 14776336)
  return value
}

const upload = middleware.upload({
  fileField: 'f',
  uploadDir: path.join(process.env.UPLOAD_FOLDER, 'incoming')
})

router.post('/', upload, middleware.db, middleware.user, async (req, res, next) => {
  try {
    res.type('text/plain; charset=utf-8')
    if (!req.user) {
      debug('Not authenticated.')
      if (req.file) {
        req.file.abort()
      }
      res.status(403).end('-1')
      return
    }
    if (!req.file) {
      debug('No file.')
      res.status(400).end('-1')
      return
    }

    req.file.on('finish', async (bytesWritten) => {
      debug('end on file fired')
      try {
        const md5hash = await md5File(req.file.filePath)
        debug(`User md5hash: ${req.body.c}; calculated md5hash: ${md5hash}`)
        if (req.body.c && req.body.c !== md5hash) {
          debug('md5 hashes do not match. aborting.')
          req.file.unlink()
          res.status(400).end('-1')
          return
        }

        let mediaType = mime.getType(req.file.filename)
        debug(`Detected media type: ${mediaType}`)
        if (!mediaType) {
          const type = fileType(await readChunk(req.file.filePath, 0, 4100))
          if (type) {
            mediaType = type.mime
            debug(`Discovered media type: ${mediaType}`)
          }
        }
        // both mime.getType() and fileType() return null when there is no match
        debug(`Media type sent by client: ${req.file.mimeType}`)

        let processedOriginalName = null
        if (typeof req.file.filename === 'string') {
          processedOriginalName = path.posix.basename(req.file.filename.normalize().replace(/\\/g, '/')).trim()
          if (processedOriginalName === '') {
            processedOriginalName = null
          } else if (typeof mediaType === 'string' && !/\./.test(processedOriginalName)) {
            const extension = mime.getExtension(mediaType)
            if (typeof extension === 'string') {
              processedOriginalName += `.${extension}`
            }
          }
        }

        let isBinary = null
        try {
          isBinary = await isBinaryFile(req.file.filePath)
        } catch (e) {
          debug(e)
        }

        debug(`Is binary file? ${isBinary}`)

        let ttl = null
        if (typeof req.body.ttl === 'string') {
          const userTtl = parseInt(req.body.ttl)
          if (!Number.isNaN(userTtl) && userTtl >= 0) {
            ttl = userTtl
          }
        }

        debug(`Time to live been given? ${ttl}`)

        try {
          await req.file.move(path.join(process.env.UPLOAD_FOLDER, 'finished'))
        } catch (e) {
          debug(`Could not move file: ${e}`)
          req.file.unlink()
          res.status(500).end(-1)
        }

        let inserted = false
        let id
        for (let i = 0; i < 10; i++) {
          try {
            id = await randomId()

            debug(`random id: ${id}`)

            await req.db.run(`
              INSERT INTO upload (id, owner, originalName, processedOriginalName, mediaType, isBinary, size, md5hash, location, timestamp, ttl)
              VALUES ($id, $owner, $originalName, $processedOriginalName, $mediaType, $isBinary, $size, $md5hash, $location, $timestamp, $ttl)
              `, {
                $id: id,
                $owner: req.user.id,
                $originalName: req.file.filename,
                $processedOriginalName: processedOriginalName,
                $mediaType: mediaType,
                $isBinary: isBinary,
                $size: bytesWritten,
                $md5hash: md5hash,
                $location: path.basename(req.file.filePath),
                $timestamp: Date.now(),
                $ttl: ttl
              }
            )
            inserted = true
            debug('Upload file row inserted into database')
            break
          } catch (e) {
            debug(`Error (attempt #${i + 1}) while inserting upload file row in db: ${e}`)
          }
        }

        if (!inserted) {
          debug('Could not add row to database. Aborting.')
          req.file.unlink()
          res.status(500).end('-1')
          return
        }

        res.end(`1,${process.env.URL_PREFIX}${base62.encode(id)},${id},${bytesWritten}`)
        debug('Upload has been succesfully finalized')
      } catch (e) {
        next(e)
      }
    })

    req.file.on('abort', () => {
      debug('File upload aborted')
      res.status(500).end('-1')
    })

    req.file.save()
  } catch (e) {
    next(e)
  }
})

module.exports = router
