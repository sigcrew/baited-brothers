# 어종 판별 QA 데이터

## 실제 어종 사진 후보

`open-photo-candidates.json`은 GBIF, iNaturalist, Wikimedia Commons에서
수집한 공개 라이선스 후보의 출처, 저작자, 라이선스와 검토 상태를 보관한다.
상업 앱 QA에 사용할 수 있도록 CC0, CC BY, CC BY-SA, Public Domain만
허용하며 NC·ND·All Rights Reserved는 제외한다. 현재 후보는 테스트 정답으로
확정된 데이터가 아니다.

1. `npm run qa:collect-open-photo-candidates`로 후보 메타데이터를 갱신한다.
2. 목표 미달 종만 다시 조회하려면 `-- --only-missing`을 붙인다.
   특정 종만 보강하려면 FIELD 60 순번을 쉼표로 지정한다.

   ```bash
   PHOTO_CANDIDATE_SPECIES_SORTS=3,4,12 PHOTO_CANDIDATES_PER_SPECIES=50 \
   npm run qa:collect-open-photo-candidates -- --only-missing
   ```
3. 기존 manifest의 이미지는
   `npm run qa:collect-open-photo-candidates -- --download-existing --resume`으로 받는다.
   파일 다운로드 결과와 SHA-256 중복 제거 내역은
   `open-photo-candidates/_download-summary.json`에 기록된다.
4. 다운로드 폴더는 용량과 라이선스 재검토 문제로 Git에 포함하지 않는다.
5. 종 동정, 한 마리 이상 식별 가능 여부, 과도한 편집 여부, 라이선스를 확인한다.
6. 승인한 항목만 `reviewStatus`를 `approved`로 변경한다.
7. 종마다 서로 다른 환경의 승인 사진 5장 이상을 확보한다.
8. 평가 manifest에 승인 사진만 넣고 `npm run qa:fish-recognition`을 실행한다.

승인한 평가 이미지는 후보 폴더를 다시 만들 때 유실되지 않도록
`npm run qa:preserve-fish-holdout`으로 별도 보존한다. 학습 split에는 이 보존
manifest를 `--holdout-manifest`로 지정하여 평가 원본이 학습에 섞이지 않게 한다.

### FIELD 60 전용 분류 헤드 진행 현황

2026-07-21 공개 라이선스 후보와 종이 명시된 파생 패널을 보강했다. 현재
로컬 후보 파일 1,574장에는 재수집 과정의 완전 중복 45세트가 포함되며,
자동 감사에서 1,313장이 해상도·흐림·밝기 기준을 통과했다. 취약 종 육안
검수에서 문서·엑스레이·삽화·조리 사진 44장을 제외했고, 같은 관측/표본은
최대 4장으로 제한해 52장의 과다 반복을 제거했다. 최신 잠정 split은
1,176장이며 29/60종이
종별 20장 기준을 충족한다. 자동 품질 및 사진 유형 통과는 종 동정 승인을
의미하지 않으며, 출시용 학습에는 생물학적 동정의 사람 승인이 필요하다.

```bash
npm run qa:audit-training-photos
python3 scripts/prepare-fish-training-split.py --provisional-quality-pass
python3 scripts/train-field60-head.py \
  --model /path/to/fishial/model.pt \
  --split qa/fish-recognition/training-split-manifest.json
```

Fishial 동결 임베딩 위에 선형 FIELD 60 헤드를 잠정 학습한 뒤, 검증에서
정한 16 epoch로 홀드아웃을 제외한 당시 1,164장 전체를 리핏했다. 국립수산과학원
공공누리 제1유형 황돔 실사진을 보강한 모델은 독립 승인 홀드아웃 55장에서
Top-1 50.9%, Top-3 81.8%(45/55)를 기록했다. 이전 80.0%에서 황돔 1종이
추가로 정답 후보에 포함됐다.

이후 ZooKeys 논문의 CC BY 4.0 점농어 패널 3장을 종 라벨에 맞춰 추출해
보강했다. 점농어 보강 split으로 학습한 리핏 모델은 점농어 홀드아웃을
맞혔지만 전체 Top-3는 80.0%(44/55)로 낮아져 채택하지 않았다. 기존 최적
모델과 보강 모델의 로짓 앙상블도 Top-3 81.8%(45/55)로 동률이고 Top-1은
49.1%로 낮아 기존 최적 모델을 유지한다. 출시 목표 Top-3 90%에는 미달하며
현재 모델은 앱 런타임에 연결하지 않고, 부족 종 보강과 사람 승인 후
재학습한다.

추가로 돌가자미·긴꼬리벵에돔·보구치·살오징어·창꼴뚜기를 50장 목표로
재검색했다. 공개 API에서 살오징어 유효 표본은 8장에서 12장으로 늘었고,
다른 종은 새 후보가 거의 없었다. Yang & Herrmann (2025)의 CC BY 4.0
[보구치 논문 Figure 2](https://www.mdpi.com/2410-3888/10/12/622)에서 종이
명시된 어체 영역 한 장을 추가해 보구치 유효 표본은 4장이 됐다. 갱신
데이터의 기본 선형 헤드는 홀드아웃 Top-1 50.9%, Top-3 81.8%(45/55)로
동률이었지만 기존에 맞힌 돌가자미·보구치·꽁치가 회귀했다. 평균 앙상블도
Top-3 81.8%에 머물러 기존 최적 모델을 유지한다. 수평 반전과 클래스 가중치
0.5/0.75 실험도 검증·테스트 평균을 개선하지 못해 채택하지 않았다.

후보 수집기는 `--only-missing --download` 재실행 시 제공처 자산 ID로 기존
파일을 재사용한다. 수동 사진 유형 판정도 파일의 표시 순번이 아니라 제공처
자산 ID로 이어받아 재수집 후 검수 결과가 유실되지 않는다. 논문·공공기관
수동 보강 사진의 출처와 라이선스는 `manual-photo-sources.json`에 기록한다.

MBRIS에서 공공누리 제1유형으로 공개된 국립해양생물자원관 표본 사진을
추가 확인해 문치가자미 MABIK PI00051763, 돌가자미 MABIK PI00051762,
노래미 MABIK PI00051654, 보구치 MABIK PI00051704, 낙지 MABIK
MO00178105를 보강했다. 다섯 사진 모두 전신과 주요 식별 특징이 보이는
실물 표본이며 자동 품질 기준을 통과했다. 현재 잠정 split의 유효 표본은
문치가자미 12장, 돌가자미 5장, 노래미 32장, 보구치 5장, 낙지 42장이다.
긴꼬리벵에돔·창꼴뚜기는 추가 상업 이용 가능 원본을 찾지 못했다.
사이트 전체 약관이 상업적 재사용을 제한하거나 CC BY-NC/ND인 사진은 개별
페이지에 다운로드 링크가 있어도 제외한다.

### 구조 개선 측정

전역 FIELD 60 헤드 뒤에 어류/두족류 이진 게이트와 두족류 8종 전용 헤드를
추가하고, 농어·점농어 혼동쌍만 보수적으로 후보를 보완했다. 내부 검증은
Top-3 82.3% → 82.8%, 내부 테스트는 86.0%로 동일했으며, 고정 홀드아웃은
81.8%(45/55) → 85.5%(47/55)로 개선됐다. 실행 방법은 다음과 같다.

```bash
/path/to/python scripts/evaluate-field60-structured-reranker.py \
  --model /path/to/fishial/model.pt \
  --head ml/fishial/artifacts/field60-linear-head.pt
```

생성되는 `field60-structured-report.json`의 `provisional` 값이 `true`인 동안은
실배포 승인 결과가 아니다. 60종 생물학적 동정 승인과 더 큰 원본 분리
홀드아웃에서 같은 기준을 다시 통과해야 한다.

운영 프로젝트를 대상으로 평가할 때는 `npm run qa:fish-recognition:live`를
사용한다. 이 명령은 임시 인증 사용자를 생성해 평가가 끝난 뒤 자동 삭제한다.
결과 파일이 필요하면 `QA_RESULT_PATH=/tmp/fish-recognition-result.json`을 함께
설정한다.

운영 `identify-fish`는 품질·피사체·도감 그룹을 먼저 판정하고, 통과한 그룹의
어종만 2차 비교한다. 작은 피사체, 픽셀화, 머리·몸통 등 핵심 부위 누락은
후보를 만들지 않고 재촬영으로 처리한다. 빠른 회귀 확인에는 아래 매니페스트를
사용한다.

Claude 응답은 강제 도구 호출의 입력 객체로 받아 문자열 JSON 파싱 오류를
피한다. 2차 후보가 한 그룹에만 몰리면 도감의 인접 그룹을 한 번 더 비교해
주 그룹 1개와 인접 그룹 최대 2개로 Top-3 다양성을 보강한다. 보조 비교가
실패해도 기본 후보는 그대로 반환한다.

```bash
QA_MANIFEST_PATH=qa/fish-recognition/two-stage-regression-manifest.json \
QA_CONCURRENCY=1 \
npm run qa:fish-recognition:live
```

2026-07-20 운영 회귀 결과는 승인 어종 5장 Top-3 100%, 비어류 30장 거부
100%, 저품질 30장 거부 100%, 서버 오류 0건이다. 어종 정답 표본은 아직
5장뿐이므로 이 수치는 회귀 기준 통과를 의미하며, 60종 출시 정확도를
통계적으로 확정하는 근거로 사용하지 않는다.

사람의 승인을 기다리는 GBIF 후보 전체를 잠정적으로 측정하려면
`npm run qa:prepare-provisional-evaluation`로 별도 manifest를 만든 뒤
`QA_MANIFEST_PATH=qa/fish-recognition/provisional-manifest.json`을 지정한다.
이 결과는 후보 라벨의 오동정 가능성이 있으므로 출시 합격 판정에는 사용하지
않는다.

2026-07-20 수집 결과는 60종 후보 587건이며 55종이 종별 10건 목표를
채웠다. 공개 후보가 부족한 돌가자미·불볼락·긴꼬리벵에돔·황돔·창꼴뚜기는
5~9건이다. 검증된 구학명도 검색하되 유사종 이름은 섞지 않는다.

실제 다운로드는 481건 성공, 동일 파일 30건 제거, 제공처의 403·429 등
76건 실패로 집계됐다. 다운로드 실패는 후보 메타데이터를 삭제하지 않으므로
나중에 다시 시도할 수 있다. 이 숫자는 자동 수집량이며, 사람의 종 동정과
라이선스 확인을 통과한 승인 표본 수가 아니다.

### 60종 잠정 Top-3 스크리닝

2026-07-20 실제 관찰 사진을 우선해 종별 1장씩 운영 `identify-fish`에
입력한 잠정 결과는 Top-1 13/60(21.7%), Top-3 18/60(30.0%)였다.
서버 오류는 없었다.

- 실제 어종 사진 60장 중 후보 반환: 26장
- 실제 어종 사진을 재촬영으로 거부: 34장
- 후보 반환 사진만 계산한 Top-1: 13/26(50.0%)
- 후보 반환 사진만 계산한 Top-3: 18/26(69.2%)

자동 수집 후보에는 X-ray, 표본대장, 도해, 음식, 산란물, 다른 동물이
주 피사체인 사진이 섞여 있었다. 이들은 모델이 올바르게 거부했지만 평가
정답으로는 부적합하다. 실제 어체가 분명한 사진도 전신 가림이나 수중 탁도
때문에 재촬영 처리되는 경우가 많아 품질 게이트도 추가 조정이 필요하다.

따라서 이 결과는 출시 정확도가 아니라 데이터 정제와 게이트 조정을 위한
스크리닝 수치다. 종별 5장, 총 300장 본 평가는 각 사진을 사람이 승인하고
60종 모두 최소 5장을 충족한 뒤 실행한다.

### 육안 승인 대표 사진 Top-3 측정

`npm run qa:prepare-reviewed-evaluation`은 문서·X-ray·일러스트·조리 사진,
중복과 명백한 오동정 후보를 제외하고 육안 승인한 대표 실사진으로
`approved-manifest.json`을 만든다. 이 검수는 분류학 전문가 감수를 대체하지
않는다.

2026-07-21 승인 대표 사진 59장으로 운영 `identify-fish`를 재측정한 결과는
Top-1 24/59(40.7%), Top-3 30/59(50.8%), 서버 오류 0건이었다. 후보를
만들지 않은 사진은 14장, 후보를 반환했지만 정답이 Top-3에 없는 사진은
15장이었다. 민어는 공개 라이선스와 품질 기준을 함께 충족하는 온전한 개체
사진을 찾지 못해 이번 측정에서 제외했다.

```bash
npm run qa:prepare-reviewed-evaluation
QA_MANIFEST_PATH=qa/fish-recognition/approved-manifest.json \
QA_CONCURRENCY=2 \
QA_RESULT_PATH=/tmp/baited-brothers-reviewed-top3.json \
npm run qa:fish-recognition:live
QA_RESULT_PATH=/tmp/baited-brothers-reviewed-top3.json \
npm run qa:summarize-fish-recognition
```

이 결과는 자동 후보보다 정답 신뢰도가 높지만 종별 1장뿐인 커버리지
측정이다. 출시 기준인 종별 5장, Top-3 90%를 충족하지 않으며 다음 개선
우선순위는 후보 없음 14종의 품질 게이트 조정과 오답 후보 15종의 유사종
식별 특징 보강이다.

## 거부 데이터

비어류와 저품질 사진은 각각 30장을 구성했다. 비어류는 GBIF 공개 라이선스
관찰 사진이며, 저품질 세트는 앱에서 검수된 실제 어종 사진 5장에 6가지
열화 조건을 적용한 재현 가능한 파생본이다.

- 비어류: 고양이, 개, 토끼, 조류, 불가사리, 게 각 5장
- 저품질: 흔들림, 역광, 야간, 부분 잘림, 작은 피사체

`npm run qa:prepare-rejection-data`를 실행하면 파일과 manifest를 다시 만들 수
있다. 출처와 라이선스, 열화 조건은 `rejection-sources.json`에 기록된다.

외부 AI로 전송되는 사진에는 얼굴, 차량번호, 위치 메타데이터 등 불필요한
개인정보가 없어야 한다.
