const base62Table = [...'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ']
const revBase62Table = base62Table.reduce((o, char, i) => {
  o[char] = i
  return o
}, Object.create(null))

// emoji sourced from https://github.com/watson/base64-emoji
const base62EmojiTable = [...'🌗🐠💖🌺🕘🕠🎳👔🍟💽🍴🐎🛀🅰📶🔆😱😬🍺🚒🕖💩🏦🐒🍌🔎🌜🚢🐗💭🍕📄🌋🍑👒💀💏🐀📙💍🐷🍏😮🚼🚸🚔🏠🌵👈😳📦💡🍍📵😍📓🙌🕡🕤🐊🐇🎎']
const revBase62EmojiTable = base62EmojiTable.reduce((o, char, i) => {
  o[char] = i
  return o
}, Object.create(null))

function encode (n, table = base62Table) {
  if (n < 0 || n >= 14776336) {
    throw new RangeError('Input should be between 0 (incl) and 14,776,336 (excl)')
  }
  const char0 = table[n % 62]
  n = (n / 62) >> 0
  const char1 = table[n % 62]
  n = (n / 62) >> 0
  const char2 = table[n % 62]
  n = (n / 62) >> 0
  const char3 = table[n]
  return [char3, char2, char1, char0].join('')
}

encode.emoji = function encodeEmoji (n) { return encode(n, base62EmojiTable) }

function decode (str, table = revBase62Table) {
  if (typeof str !== 'string') {
    throw new Error('Input should be a 4-char string')
  }
  const chars = [...str]
  if (chars.length !== 4) {
    throw new Error('Input should be a 4-char string')
  }

  if (!(chars[0] in table && chars[1] in table && chars[2] in table && chars[3] in table)) {
    throw new Error('Input contains invalid characters')
  }

  return table[chars[3]] +
    (table[chars[2]] * 62) +
    (table[chars[1]] * 62 ** 2) +
    (table[chars[0]] * 62 ** 3)
}

decode.emoji = function decodeEmoji (n) { return decode(n, revBase62EmojiTable) }

module.exports = {
  encode,
  decode,
  base62Table,
  base62EmojiTable
}
