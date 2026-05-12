/**
 * generate-icons.js
 * Creates placeholder PWA icons using pure Node.js — no external deps.
 *
 * Writes:
 *   client/public/icons/icon-192.png  (192×192, moss green #6B7C5C, white "K")
 *   client/public/icons/icon-512.png  (512×512, same)
 *
 * Usage:  node scripts/generate-icons.js
 *
 * Replace with real branded artwork before deploying.
 */

const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(ICONS_DIR, { recursive: true })

// ── Minimal PNG encoder (pure Node) ──────────────────────────────────────────
// Supports 8-bit RGBA only.

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })())
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len       = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const crcBuf    = Buffer.concat([typeBytes, data])
  const crcVal    = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf), 0)
  return Buffer.concat([len, typeBytes, data, crcVal])
}

function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of length width*height*4 (RGBA)
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width,  0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8]  = 8   // bit depth
  ihdr[9]  = 2   // color type: RGB (we'll strip alpha for simplicity)
  ihdr[10] = 0   // compression
  ihdr[11] = 0   // filter
  ihdr[12] = 0   // interlace

  // Raw image data: filter byte (0) + RGB per row
  const rows = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    row[0] = 0 // filter type: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      row[1 + x * 3]     = pixels[src]     // R
      row[1 + x * 3 + 1] = pixels[src + 1] // G
      row[1 + x * 3 + 2] = pixels[src + 2] // B
    }
    rows.push(row)
  }
  const raw  = Buffer.concat(rows)
  const comp = zlib.deflateSync(raw)

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', comp),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Rasterize a "K" glyph ─────────────────────────────────────────────────────
// 7×9 pixel bitmap for the letter K (1 = foreground)
const K_BITMAP = [
  [1,0,0,0,1,0,0],
  [1,0,0,1,0,0,0],
  [1,0,1,0,0,0,0],
  [1,1,0,0,0,0,0],
  [1,1,0,0,0,0,0],
  [1,0,1,0,0,0,0],
  [1,0,0,1,0,0,0],
  [1,0,0,0,1,0,0],
  [1,0,0,0,0,1,0],
]

function makeIcon(size) {
  const pixels = new Uint8Array(size * size * 4)

  // Background: moss green #6B7C5C
  const bgR = 0x6b, bgG = 0x7c, bgB = 0x5c
  // Glyph: white
  const fgR = 0xff, fgG = 0xff, fgB = 0xff

  // Fill background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4]     = bgR
    pixels[i * 4 + 1] = bgG
    pixels[i * 4 + 2] = bgB
    pixels[i * 4 + 3] = 255
  }

  // Scale K glyph to ~40% of icon size, centered
  const glyphRows = K_BITMAP.length       // 9
  const glyphCols = K_BITMAP[0].length    // 7
  const scale     = Math.floor(size * 0.06)  // pixel size per glyph cell
  const glyphW    = glyphCols * scale
  const glyphH    = glyphRows * scale
  const offX      = Math.floor((size - glyphW) / 2)
  const offY      = Math.floor((size - glyphH) / 2)

  for (let row = 0; row < glyphRows; row++) {
    for (let col = 0; col < glyphCols; col++) {
      if (!K_BITMAP[row][col]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = offX + col * scale + dx
          const py = offY + row * scale + dy
          if (px < 0 || px >= size || py < 0 || py >= size) continue
          const idx = (py * size + px) * 4
          pixels[idx]     = fgR
          pixels[idx + 1] = fgG
          pixels[idx + 2] = fgB
          pixels[idx + 3] = 255
        }
      }
    }
  }

  return encodePNG(size, size, pixels)
}

const sizes = [192, 512]
for (const s of sizes) {
  const outPath = path.join(ICONS_DIR, `icon-${s}.png`)
  fs.writeFileSync(outPath, makeIcon(s))
  console.log(`✓  ${outPath}`)
}
console.log('\nDone. Replace with real branded icons before deploying.')
