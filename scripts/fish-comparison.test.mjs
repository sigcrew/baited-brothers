import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectReviewCandidates, cropRectangle } from './fish-comparison-data.mjs';

test('review queue excludes holdout origins, rejected photos, and duplicate content', () => {
  const photo = { speciesSort: 1, autoStatus: 'quality-pass', biologicalReview: 'pending', photoTypeReview: 'pending' };
  const rows = [
    { ...photo, file: 'holdout-copy', sha256: 'held', sourceUrl: 'a' },
    { ...photo, file: 'same-observation', sha256: 'new', sourceUrl: 'held-origin' },
    { ...photo, file: 'rejected', sha256: 'bad', sourceUrl: 'b', photoTypeReview: 'rejected' },
    { ...photo, file: 'one', sha256: 'one', sourceUrl: 'c' },
    { ...photo, file: 'duplicate', sha256: 'one', sourceUrl: 'd' },
    { ...photo, file: 'two', sha256: 'two', sourceUrl: 'e' },
  ];
  const selected = selectReviewCandidates(rows, { species: [1], excludedHashes: ['held'], excludedOrigins: ['held-origin'], limit: 20 });
  assert.deepEqual(selected.map(x => x.file), ['one', 'two']);
  assert.ok(selected.every(x => x.biologicalReview === 'pending'));
});

test('normalized crop keeps edge pixels inside image dimensions', () => {
  assert.deepEqual(cropRectangle({ x: 0.1, y: 0.2, width: 0.9, height: 0.8 }, 101, 51), { left: 10, top: 10, width: 91, height: 41 });
  assert.throws(() => cropRectangle({ x: -0.1, y: 0, width: 1, height: 1 }, 100, 100));
  assert.throws(() => cropRectangle({ x: 0, y: 0, width: 0, height: 1 }, 100, 100));
});

test('review selection groups GBIF media and normalized cross-provider observations', () => {
  const base = { speciesSort: 1, autoStatus: 'quality-pass', provider: 'gbif' };
  const rows = [
    { ...base, sha256: 'a', sourceUrl: 'https://www.inaturalist.org/photos/10', providerAssetId: '123:0' },
    { ...base, sha256: 'b', sourceUrl: 'https://www.inaturalist.org/photos/11', providerAssetId: '123:1' },
    { ...base, sha256: 'c', sourceUrl: 'https://www.inaturalist.org/photos/12', providerAssetId: '456:0', canonicalObservation: 'http://www.inaturalist.org/observations/77' },
    { ...base, provider: 'inaturalist', sha256: 'd', sourceUrl: 'https://www.inaturalist.org/observations/77/', providerAssetId: '88' },
  ];
  assert.deepEqual(selectReviewCandidates(rows, { species: [1] }).map(x => x.sha256), ['a', 'c']);
  assert.deepEqual(selectReviewCandidates(rows, { species: [1], excludedOrigins: ['gbif:123', 'https://www.inaturalist.org/observations/77'] }), []);
});
