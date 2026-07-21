# Fishial FIELD 60 실험

## 결론

Fishial `classification_model_v0.10.2`는 DinoV2 계열 어류 특징 추출기로는
사용할 수 있지만, 공개된 866개 최종 분류 라벨을 그대로 FIELD 60에 연결하면
안 된다.

- Fishial 최신 모델: 866종, 768차원 임베딩, 입력 `154 × 434`
- FIELD 60과 학명이 정확히 일치하는 종: 9종
- 직접 라벨 커버리지: 15%
- 두족류 8종은 Fishial 분류 범위 밖이므로 별도 학습이 필요하다.

직접 지원되는 종은 강도다리, 참돔, 농어, 고등어, 망치고등어, 부시리,
청어, 숭어, 양태다.

따라서 채택 후보는 다음과 같다.

```text
사용자 사진
  → 비어류·저품질 게이트
  → Fishial 임베딩(768)
  → FIELD 60 승인 레퍼런스 centroid/KNN
  → Top-3
  → Claude 식별 특징 재검토
  → 사용자 확정
```

Fishial 공개 정확도 92.23%는 Fishial의 866종 검증 세트 결과다. FIELD 60
정확도로 해석하지 않는다.

## 2026-07-21 기준선

육안 승인 평가 사진 59장과 종별 GBIF 참조 사진 5장(총 300장)을 서로
분리해 측정했다.

| 방식 | Top-1 | Top-3 |
| --- | ---: | ---: |
| Claude 단독 | 40.7% | 50.8% |
| Fishial 임베딩 + 종 중심점 | 42.4% | 55.9% |
| Fishial 개별 참조 최대 유사도 | 35.6% | 54.2% |
| Fishial 상위 2개 참조 평균 | 37.3% | 54.2% |
| Fishial + 정답 그룹 제한(낙관적 상한) | 54.2% | 79.7% |

Claude Top-3와 Fishial Top-3 후보의 합집합에는 59장 중 45장의 정답이
포함되어 후보 recall은 76.3%다. 합집합은 최대 6개 후보이므로 최종 Top-3
정확도와 같지 않다. 현재 모델은 단독 배포 기준을 통과하지 못했지만,
FIELD 60 전용 분류 헤드를 학습할 때 초기 특징 추출기와 보조 후보
생성기로 사용할 가치가 있다.

운영 연결 전 조건:

1. 종별 승인 실사진을 최소 20장 이상으로 늘리고 촬영 환경을 분리한다.
2. 학습·검증 사진의 원본 및 근접 중복을 제거한다.
3. Fishial 임베딩 위에 FIELD 60 전용 분류 헤드를 학습한다.
4. 별도 검증 세트에서 Top-3 90%와 거부율 95%를 통과한다.
5. 실패 시 현재 Claude + 사용자 확인 흐름을 유지한다.

## FIELD 60 헤드 잠정 결과

공개 라이선스 후보와 종이 명시된 파생 패널 1,542장 중 자동 화질 검사를
통과한 1,321장을 대상으로 문서·삽화·조리 사진 43장을 제외하고, 한 원본
관측/표본은 최대 4장으로 제한했다. 검증으로 학습 설정을 고른 뒤 전체
1,167장을 16 epoch 리핏한
선형 헤드는 독립 홀드아웃 55장에서 Top-1 50.9%, Top-3 81.8%(45/55)를
기록했다. 비선형 MLP, 어종군 보조 헤드와 구형 선형 헤드 로짓 앙상블은
추가 개선이 없어 채택하지 않았다.

이 수치는 자동 품질 통과 후보를 사용한 잠정 실험이다. 60종별 생물학적
동정 승인과 종별 최소 20장 조건이 끝나지 않아 실배포 승인 수치가 아니다.
현재 정제 기준 29/60종만 20장을 충족한다. CC BY 4.0 논문의 점농어 패널
3장을 보강한 전용 리핏 모델은 점농어를 맞혔지만 전체 Top-3가 80.0%로
하락했고, 기존 모델과의 앙상블도 81.8%로 동률이라 채택하지 않았다. 기존
최적 모델의 홀드아웃 오답은 문치가자미·참가자미·노래미·긴꼬리벵에돔·
점농어·청어·전어·살오징어·창꼴뚜기·낙지이며, 황돔과 보구치도 승인 사진
20장 기준에는 아직 미달한다.

후속 보강에서 살오징어 유효 표본 4장과 CC BY 4.0 보구치 논문 사진 1장을
추가했다. 새 리핏 모델은 살오징어를 맞혔지만 돌가자미·보구치·꽁치가
회귀해 Top-3 81.8% 동률이었고, 기존 모델과의 앙상블도 개선되지 않았다.
따라서 배포 후보 artifact는 교체하지 않았다.

## 2단계 구조 개선 결과

전역 60종 헤드를 유지하면서 Fishial의 원 학습 범위 밖인 두족류에는
어류/두족류 이진 게이트와 8종 전용 헤드를 추가했다. 게이트 확률이 0.95
이상일 때만 전역 Top-2와 두족류 전용 Top-1을 합친다. 어류에서는 형태가
매우 가까운 농어·점농어(`Lateolabrax`)가 1위일 때 서로를 Top-3 한 자리에
포함하는 보수적인 sibling completion만 적용한다.

이 구조는 내부 검증 198장에서 163/198 → 164/198, 내부 테스트 207장에서
178/207 → 178/207로 회귀가 없었다. 고정 독립 홀드아웃 55장에서는
45/55(81.8%) → 47/55(85.5%)로 개선됐다. Top-1은 28/55(50.9%)로 동일하다.
재현 스크립트는 `scripts/evaluate-field60-structured-reranker.py`, 보조 헤드와
보고서는 `ml/fishial/artifacts/field60-cephalopod-auxiliary.pt` 및
`field60-structured-report.json`이다.

단, 이 결과는 자동 품질 통과 사진을 포함한 잠정 실험이며 홀드아웃도
종별 최대 1장인 소규모 세트다. 목표 85%는 넘었지만 종별 사람 승인과 더
큰 독립 테스트가 끝나기 전에는 실배포 승인 수치로 간주하지 않는다.

## 재현

공식 ZIP 내부 `model.pt`는 Git에 넣지 않는다. 모델과 라이선스는
[Fishial 공식 저장소](https://github.com/fishial/fish-identification)에서
확인한다.

```bash
npm run qa:audit-fishial -- /path/to/fishial-class-mapping.json

/path/to/python scripts/evaluate-fishial-knn.py \
  --model /path/to/model.pt \
  --references qa/fish-recognition/gbif-candidates \
  --manifest qa/fish-recognition/approved-manifest.json \
  --output /tmp/fishial-field60-knn.json

npm run qa:compare-fishial-claude -- \
  /tmp/baited-brothers-reviewed-top3.json \
  /tmp/fishial-field60-knn.json

# 자동 품질 조건만 사용한 로컬 파이프라인 검증. 실배포 승인 데이터가 아니다.
/path/to/python scripts/audit-fish-training-images.py
/path/to/python scripts/prepare-fish-training-split.py \
  --provisional-quality-pass
/path/to/python scripts/train-field60-head.py \
  --model /path/to/fishial/model.pt

# 검증에서 epoch를 고른 뒤 외부 holdout 평가용 전체 리핏
/path/to/python scripts/train-field60-head.py \
  --model /path/to/fishial/model.pt \
  --refit-all-epochs 103
```

KNN 결과가 현재 Claude 기준 Top-3 50.8%보다 높고 오답 분포가 상호 보완적일
때만 운영 파이프라인의 후보 생성기로 연결한다. 자동 수집 사진은 종 동정과
라이선스 검수를 완료하기 전까지 학습·출시 승인 데이터로 간주하지 않는다.
