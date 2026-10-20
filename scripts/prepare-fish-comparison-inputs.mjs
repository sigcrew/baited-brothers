import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { cropRectangle } from './fish-comparison-data.mjs';

const dir = path.resolve('qa/fish-recognition/input-model-comparison');
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json')));
// Manual visual regions are frozen before inference. This tests selected detail,
// not an automatic detector. The original view is always retained.
const regions = {
  'reviewed-01': [0.2, 0.3, 0.62, 0.6], 'reviewed-02': [0.2, 0.15, 0.7, 0.55],
  'reviewed-06': [0, 0.24, 0.97, 0.63], 'reviewed-07': [0.05, 0.32, 0.9, 0.52],
  'reviewed-13': [0.08, 0.35, 0.85, 0.62], 'reviewed-16': [0, 0.15, 0.65, 0.72],
  'reviewed-17': [0.16, 0.3, 0.7, 0.3], 'reviewed-22': [0.02, 0.43, 0.98, 0.36],
  'reviewed-31': [0, 0.05, 0.68, 0.88], 'reviewed-43': [0.02, 0.15, 0.85, 0.78],
  'reviewed-55': [0.36, 0.35, 0.45, 0.38],
};
await fs.mkdir(path.join(dir, 'inputs'), { recursive: true });
const tiles = [];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
for (const [i, c] of manifest.cases.entries()) {
  const source = await fs.readFile(path.resolve(dir, c.path));
  let oriented = await sharp(source).rotate().png().toBuffer();
  const { width, height } = await sharp(oriented).metadata();
  const redactions = c.id === 'reviewed-02' ? [{ x: 0.39, y: 0.7, width: 0.3, height: 0.25 }] : [];
  for (const box of redactions) {
    const { left, top, width: w, height: h } = cropRectangle(box, width, height);
    const mask = await sharp({ create: { width: w, height: h, channels: 3, background: '#dddddd' } }).png().toBuffer();
    oriented = await sharp(oriented).composite([{ input: mask, left, top }]).png().toBuffer();
  }
  const [x, y, w, h] = regions[c.id] ?? [0.2, 0.2, 0.6, 0.6];
  const region = { x, y, width: w, height: h };
  const base = await sharp(oriented).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  const detail = await sharp(oriented).extract(cropRectangle(region, width, height)).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  const basePath = `inputs/${c.id}-full.jpg`;
  const detailPath = `inputs/${c.id}-detail.jpg`;
  await fs.writeFile(path.join(dir, basePath), base);
  await fs.writeFile(path.join(dir, detailPath), detail);
  Object.assign(c, { originalPath: c.path, sourceSha256: hash(source), path: basePath,
    sha256: hash(base), detailPath, detailSha256: hash(detail), detailRegion: region, redactions });
  for (const [j, bytes] of [base, detail].entries()) {
    tiles.push({ input: await sharp(bytes).resize(300, 220, { fit: 'contain', background: 'white' }).png().toBuffer(), left: j * 300, top: i * 245 + 25 });
  }
  tiles.push({ input: Buffer.from(`<svg width="600" height="25"><rect width="600" height="25" fill="white"/><text x="8" y="19" font-size="14">${c.id}: full / detail</text></svg>`), left: 0, top: i * 245 });
}
await fs.writeFile(path.join(dir, 'prepared-manifest.json'), JSON.stringify({ ...manifest, inputPolicy: 'Orientation corrected, JPEG q75, max1280. Visible species label masked in all variants. Frozen manual detail boxes; no new photographic detail synthesized.', cases: manifest.cases }, null, 2) + '\n');
await sharp({ create: { width: 600, height: manifest.cases.length * 245, channels: 3, background: 'white' } }).composite(tiles).png().toFile(path.join(dir, 'input-pairs.png'));
console.log(`Prepared ${manifest.cases.length} matched image pairs.`);
