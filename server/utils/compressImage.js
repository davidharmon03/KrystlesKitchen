const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Compress an image buffer and save as WebP.
 *
 * @param {Buffer} buffer     - Raw image buffer from multer memoryStorage
 * @param {string} outputDir  - Absolute path to the output directory (created if missing)
 * @param {string} basename   - Filename stem without extension (uuid, userId, timestamp, etc.)
 * @param {object} opts
 * @param {number} opts.maxWidth  - Max pixel width; image is shrunk if wider, never enlarged (default 1200)
 * @param {number} opts.quality   - WebP quality 1–100 (default 82)
 * @returns {Promise<string>} Saved filename, e.g. "abc123.webp"
 */
async function compressImage(buffer, outputDir, basename, opts = {}) {
  const { maxWidth = 1200, quality = 82 } = opts;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${basename}.webp`;
  const outputPath = path.join(outputDir, filename);

  await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toFile(outputPath);

  return filename;
}

module.exports = { compressImage };
