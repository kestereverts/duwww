const isBinaryFile = require('isbinaryfile')

module.exports = (filepath) => {
  return new Promise((resolve, reject) => {
    try {
      isBinaryFile(filepath, (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
