function normalizeOrigin(value) {
  const s = String(value ?? '');
  const observation = s.match(/^https?:\/\/(?:www\.)?inaturalist\.org\/observations\/(\d+)\/?(?:[?#].*)?$/);
  if (observation) return `https://www.inaturalist.org/observations/${observation[1]}`;
  const occurrence = s.match(/^https?:\/\/(?:www\.)?gbif\.org\/occurrence\/(\d+)\/?(?:[?#].*)?$/);
  return occurrence ? `gbif:${occurrence[1]}` : s;
}

export function reviewOrigins(row) {
  const origins = [row.sourceUrl, row.canonicalObservation].filter(Boolean).map(normalizeOrigin);
  if (row.provider === 'gbif' && /^\d+:\d+$/.test(row.providerAssetId ?? '')) {
    origins.push(`gbif:${row.providerAssetId.split(':')[0]}`);
  }
  return [...new Set(origins)];
}

export function selectReviewCandidates(rows, { species, excludedHashes = [], excludedOrigins = [], limit = 20 }) {
  const hashes = new Set(excludedHashes);
  const origins = new Set(excludedOrigins.map(normalizeOrigin));
  const counts = new Map();
  return rows.filter(row => {
    if (!species.includes(row.speciesSort) || row.autoStatus !== 'quality-pass' ||
        row.photoTypeReview === 'rejected' || row.biologicalReview === 'rejected' ||
        !row.sha256 || !row.sourceUrl || hashes.has(row.sha256) || reviewOrigins(row).some(origin => origins.has(origin)) ||
        (counts.get(row.speciesSort) ?? 0) >= limit) return false;
    hashes.add(row.sha256);
    reviewOrigins(row).forEach(origin => origins.add(origin));
    counts.set(row.speciesSort, (counts.get(row.speciesSort) ?? 0) + 1);
    return true;
  });
}

export function cropRectangle(box, width, height) {
  const { x, y, width: w, height: h } = box;
  if (![x, y, w, h, width, height].every(Number.isFinite) || x < 0 || y < 0 ||
      w <= 0 || h <= 0 || x + w > 1.000001 || y + h > 1.000001 || width < 1 || height < 1) {
    throw new Error('Invalid crop rectangle');
  }
  const left = Math.floor(x * width);
  const top = Math.floor(y * height);
  return { left, top, width: Math.min(width, Math.ceil((x + w) * width)) - left,
    height: Math.min(height, Math.ceil((y + h) * height)) - top };
}
