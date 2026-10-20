import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { selectReviewCandidates, reviewOrigins } from './fish-comparison-data.mjs';

const root = process.cwd();
const qa = path.join(root, 'qa/fish-recognition');
const out = path.join(qa, 'input-model-comparison');
const read = async name => JSON.parse(await fs.readFile(path.join(qa, name), 'utf8'));
const write = async (name, data) => fs.writeFile(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const species = [1, 2, 6, 7, 13, 16, 17, 21, 22, 31, 43, 55];
await fs.mkdir(path.join(out, 'thumbnails'), { recursive: true });
const [holdout, audit, source, review] = await Promise.all([
  read('approved-holdout/manifest.json'), read('training-photo-audit.json'),
  read('open-photo-candidates.json'), read('targeted-photo-review.json'),
]);
const decisions = new Map(review.decisions.map(d => [d.file, d]));
const rows = audit.images.map(r => ({ ...r, ...decisions.get(r.file) }));
const heldHashes = new Set([...holdout.cases, ...(holdout.quarantinedCases ?? [])].map(c => c.sha256));
const heldFiles = new Set(rows.filter(r => heldHashes.has(r.sha256)).map(r => r.file));
let changed = true;
while (changed) {
  changed = false;
  for (const pair of audit.nearDuplicatePairs) {
    if (heldFiles.has(pair.left) || heldFiles.has(pair.right)) {
      for (const file of [pair.left, pair.right]) if (!heldFiles.has(file)) { heldFiles.add(file); changed = true; }
    }
  }
}
const excluded = rows.filter(r => heldFiles.has(r.file));
const queue = selectReviewCandidates(rows, { species,
  excludedHashes: [...heldHashes, ...excluded.map(r => r.sha256)], excludedOrigins: excluded.flatMap(reviewOrigins), limit: 20 });
const sources = new Map(source.species.flatMap(s => s.candidates.map(c => [`${c.provider}:${c.providerAssetId}`, c])));
for (const row of queue) {
  const bytes = await fs.readFile(path.join(root, row.file));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw Error(`Changed source: ${row.file}`);
  const s = sources.get(`${row.provider}:${row.providerAssetId}`);
  row.creator = s?.creator ?? null;
  row.licenseUrl = s?.licenseUrl ?? null;
  row.biologicalReview = 'pending';
  row.reviewer = null;
  row.thumbnail = `thumbnails/${row.sha256}.jpg`;
  await sharp(bytes).rotate().resize(300, 200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toFile(path.join(out, row.thumbnail));
}
const summary = species.map(sort => ({ sort, nameKo: source.species.find(s => s.sort === sort).nameKo,
  selected: queue.filter(r => r.speciesSort === sort).length,
  shortfall: Math.max(0, 20 - queue.filter(r => r.speciesSort === sort).length) }));
await write('review-queue.json', { releaseEligible: false, notice: 'Source labels and automatic quality checks are not expert species approval. Holdout hashes, known near duplicates and shared origins excluded.', summary, images: queue });
const cases = holdout.cases.filter(c => species.includes(Number(c.id.split('-')[1])) && c.id !== 'reviewed-21').map(c => ({ ...c, path: `../approved-holdout/${c.path}`, labelStatus: 'legacy-QA-review-not-expert', split: 'development-regression' }));
for (const [id, kind, p] of [['non-fish-dog-01', 'non_fish', 'non-fish/non-fish-dog-01.jpg'], ['low-quality-pixelated-04', 'low_quality', 'low-quality/low-quality-pixelated-04.jpg']]) {
  cases.push({ id, kind, path: `../rejection-data/${p}`, split: 'development-regression' });
}
await write('manifest.json', { releaseEligible: false, notice: 'Fixed regression comparison, not a blind expert-verified test. Same images are used for every variant.', cases });
const tiles = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const bytes = await fs.readFile(path.resolve(out, c.path));
  if (c.sha256 && crypto.createHash('sha256').update(bytes).digest('hex') !== c.sha256) throw Error(`Holdout changed: ${c.id}`);
  const thumb = await sharp(bytes).rotate().resize(360, 230, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
  const label = Buffer.from(`<svg width="360" height="32"><rect width="360" height="32" fill="white"/><text x="8" y="22" font-size="16">${escape(c.id)}</text></svg>`);
  tiles.push({ input: thumb, left: (i % 4) * 360, top: Math.floor(i / 4) * 262 + 32 }, { input: label, left: (i % 4) * 360, top: Math.floor(i / 4) * 262 });
}
await sharp({ create: { width: 1440, height: Math.ceil(cases.length / 4) * 262, channels: 3, background: 'white' } }).composite(tiles).png().toFile(path.join(out, 'comparison-contact-sheet.png'));
await fs.writeFile(path.join(out, 'review.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><title>어종 사진 검수 대기</title><style>body{font:16px sans-serif;max-width:1250px;margin:40px auto;padding:20px;color:#182a27}section{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}article{border:1px solid #ddd;padding:12px;overflow-wrap:anywhere}img{width:100%;height:200px;object-fit:contain}small{display:block}h2{margin-top:48px}</style><h1>대표 12종 사진 검수 대기</h1><p>총 ${queue.length}장. 종 동정은 미승인입니다. 사진 유형·어종 정답·라이선스를 검수해야 학습이나 최종 평가에 사용할 수 있습니다. 파일 경로와 검수 필드는 review-queue.json에 있습니다.</p>${summary.map(s => `<h2>${escape(s.nameKo)} · ${s.selected}/20장</h2><section>${queue.filter(r => r.speciesSort === s.sort).map(r => `<article><img loading="lazy" src="${r.thumbnail}"><p>${escape(path.basename(r.file))}</p><a href="${escape(r.sourceUrl)}">원본 출처</a><small>${escape(r.creator)} · ${escape(r.license)}</small><small>어종 검수: 대기</small></article>`).join('')}</section>`).join('')}</html>`);
console.log(JSON.stringify({ summary, totalQueued: queue.length, comparisonCases: cases.length }, null, 2));
