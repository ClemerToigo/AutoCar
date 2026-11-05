const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const multer = require('multer');
const { fail } = require('./validation');
const directory = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../.local/uploads');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 7, fields: 20, fieldSize: 16 * 1024 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(Object.assign(new Error('Envie fotos JPG, PNG ou WEBP.'), { status: 400 }));
    callback(null, true);
  },
}).fields([{ name: 'foto', maxCount: 1 }, { name: 'galeria', maxCount: 6 }]);
const pattern = /^\/media\/[a-f0-9-]{36}\.webp$/;
async function discard(paths) {
  for (const photo of paths) {
    if (!pattern.test(photo)) continue;
    try { await fs.unlink(path.join(directory, path.basename(photo))); } catch (error) { if (error.code !== 'ENOENT') console.error('Não foi possível remover uma foto antiga.'); }
  }
}
async function save(file) {
  let buffer;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 20000000, failOn: 'warning' });
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) fail('Envie uma imagem JPG, PNG ou WEBP estática.');
    buffer = await image.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch (error) { if (error.status) throw error; fail('O arquivo enviado não é uma imagem JPG, PNG ou WEBP válida.'); }
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(directory, name), buffer, { flag: 'wx' });
  return `/media/${name}`;
}
async function prepare(body, files = {}, existing = null) {
  let retained = existing?.galeria || [];
  if (body.galeria_manter !== undefined) {
    try { retained = typeof body.galeria_manter === 'string' ? JSON.parse(body.galeria_manter) : body.galeria_manter; } catch { fail('Galeria inválida.'); }
    if (!Array.isArray(retained) || retained.some((item) => typeof item !== 'string' || !(existing?.galeria || []).includes(item))) fail('Seleção de fotos da galeria inválida.');
    retained = [...new Set(retained)];
  }
  if (retained.length + (files.galeria || []).length > 6) fail('A galeria permite no máximo 6 fotos.');
  const created = [];
  try {
    let foto = existing?.foto || null;
    if (body.remover_foto === true || body.remover_foto === 'true') foto = null;
    if (files.foto?.[0]) { foto = await save(files.foto[0]); created.push(foto); }
    const galeria = [...retained];
    for (const file of files.galeria || []) { const photo = await save(file); created.push(photo); galeria.push(photo); }
    return { foto, galeria, created };
  } catch (error) { await discard(created); throw error; }
}
module.exports = { upload, directory, discard, prepare };
