export function validateReview(data, queueId, photos) {
  if (!data || data.schemaVersion !== 1 || data.queueId !== queueId || !Array.isArray(data.records)) throw Error('현재 사진 목록의 검수 파일이 아닙니다.');
  const known = new Set(photos.map(p => p.sha256));
  const seen = new Set();
  const records = data.records.map(r => {
    if (!r || !known.has(r.sha256) || seen.has(r.sha256)) throw Error('알 수 없거나 중복된 사진이 있습니다.');
    seen.add(r.sha256);
    if (!['identified', 'uncertain', 'unsuitable'].includes(r.outcome)) throw Error('판정 결과를 선택하세요.');
    for (const key of ['reviewer', 'reason']) if (typeof r[key] !== 'string' || !r[key].trim() || r[key].length > 4000) throw Error('검수자와 판단 근거를 입력하세요.');
    if (!['expert', 'experienced', 'other'].includes(r.reviewerRole)) throw Error('검수 경험을 선택하세요.');
    if (typeof r.reviewedAt !== 'string' || !Number.isFinite(Date.parse(r.reviewedAt))) throw Error('검수 날짜가 올바르지 않습니다.');
    if (typeof r.species !== 'string' || r.species.length > 200 || (r.outcome === 'identified' && !r.species.trim())) throw Error('판별한 어종을 입력하세요.');
    return {sha256:r.sha256, outcome:r.outcome, species:r.species.trim(), reason:r.reason.trim(), reviewer:r.reviewer.trim(), reviewerRole:r.reviewerRole, reviewedAt:r.reviewedAt, biologicalReview:'pending'};
  });
  return {schemaVersion:1, queueId, releaseEligible:false, records};
}

export function validateAIDrafts(data, photos) {
  if (data?.schemaVersion !== 'ai-fish-draft-v1' || !Array.isArray(data.records) || data.records.length !== photos.length) throw Error('AI 초안의 사진 수가 검수 목록과 다릅니다.');
  const remaining = new Set(photos.map(p => p.sha256));
  const records = data.records.map(r => {
    if (!r || !remaining.delete(r.sha256) || !['tentative', 'hold'].includes(r.status)) throw Error('AI 초안의 사진 또는 상태가 올바르지 않습니다.');
    for (const key of ['candidate', 'observations', 'limitation', 'alternatives', 'nextPhoto']) if (typeof r[key] !== 'string' || !r[key].trim()) throw Error('AI 초안의 관찰 근거가 비어 있습니다.');
    return {...r, authorType:'ai', biologicalReview:'pending', releaseEligible:false};
  });
  return {...data, records, releaseEligible:false};
}
