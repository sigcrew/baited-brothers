# FIELD 60 v1 도감 감사

> 결정: v1은 국내 바다 생활낚시 핵심 대상 생물 60종을 메인 도감으로 하고, 나머지는 확장·참고 도감으로 분리한다.

## 원본 데이터 상태

2026-07-16 Supabase `fishes` 실데이터 기준:

| 항목 | 수량 |
|---|---:|
| 전체 원본 | 581 |
| 한국명 누락 | 172 |
| 설명 누락 | 20 |
| 이미지 누락 | 581 |
| 최소 크기 누락 | 571 |

원본은 해양생물종정보 API의 지정 29개 어류 과를 일괄 수집한 데이터다. 국내 생활낚시 대상종만 선별한 목록이 아니므로 삭제하지 않고 다음 네 상태로 감사한다.

| 상태 | 의미 |
|---|---|
| `core` | FIELD 60 v1 메인 완성도 대상 |
| `extended` | 국내 낚시 대상 가능성이 있는 확장 후보 |
| `reference` | 검색·정보 열람용 원본 |
| `needs_review` | 한국명 누락, 중복, 오분류 등 정리 필요 |

## FIELD 60

### 넙치·가자미 6

1. 넙치(광어) — `Paralichthys olivaceus`
2. 도다리 — `Pleuronichthys cornutus`
3. 문치가자미 — `Pseudopleuronectes yokohamae`
4. 참가자미 — `Pseudopleuronectes herzensteini`
5. 돌가자미 — `Platichthys bicoloratus`
6. 강도다리 — `Platichthys stellatus`

### 볼락·우럭 9

7. 조피볼락(우럭) — `Sebastes schlegelii`
8. 볼락 — `Sebastes inermis`
9. 개볼락 — `Sebastes pachycephalus`
10. 불볼락(열기) — `Sebastes thompsoni`
11. 쏨뱅이 — `Sebastiscus marmoratus`
12. 노래미 — `Hexagrammos agrammus`
13. 쥐노래미 — `Hexagrammos otakii`
14. 성대 — `Chelidonichthys spinosus`
15. 임연수어 — `Pleurogrammus azonus`

### 돔 6

16. 참돔 — `Pagrus major`
17. 감성돔 — `Acanthopagrus schlegelii`
18. 돌돔 — `Oplegnathus fasciatus`
19. 벵에돔 — `Girella punctata`
20. 긴꼬리벵에돔 — `Girella leonina`
21. 황돔 — `Dentex hypselosomus`

### 농어·민어·바리 9

22. 농어 — `Lateolabrax japonicus`
23. 점농어 — `Lateolabrax spilonotus`
24. 민어 — `Miichthys miiuy`
25. 보구치(백조기) — `Pennahia argentata`
26. 부세 — `Larimichthys crocea`
27. 참조기 — `Larimichthys polyactis`
28. 자바리 — `Epinephelus bruneus`
29. 붉바리 — `Epinephelus akaara`
30. 능성어 — `Hyporthodus septemfasciatus`

### 회유성 어종 12

31. 고등어 — `Scomber japonicus`
32. 망치고등어 — `Scomber australasicus`
33. 전갱이 — `Trachurus japonicus`
34. 방어 — `Seriola quinqueradiata`
35. 부시리 — `Seriola lalandi`
36. 삼치 — `Scomberomorus niphonius`
37. 갈치 — `Trichiurus japonicus`
38. 청어 — `Clupea pallasii`
39. 숭어 — `Mugil cephalus`
40. 가숭어 — `Planiliza haematocheilus`
41. 전어 — `Konosirus punctatus`
42. 꽁치 — `Cololabis saira`

### 연안 기타 대상어 10

43. 쥐치 — `Stephanolepis cirrhifer`
44. 말쥐치 — `Thamnaconus modestus`
45. 복섬 — `Takifugu niphobles`
46. 붕장어 — `Conger myriaster`
47. 꼬치고기 — `Sphyraena pinguis`
48. 학공치 — `Hyporhamphus sajori`
49. 보리멸 — `Sillago japonica`
50. 양태 — `Platycephalus indicus`
51. 독가시치 — `Siganus fuscescens`
52. 자리돔 — `Chromis notata`

### 오징어·문어 8

53. 살오징어 — `Todarodes pacificus`
54. 참갑오징어 — `Acanthosepion esculentum`
55. 흰꼴뚜기(무늬오징어) — `Sepioteuthis lessoniana`
56. 창꼴뚜기(한치) — `Uroteuthis edulis`
57. 주꾸미 — `Amphioctopus fangsiao`
58. 낙지 — `Octopus minor`
59. 참문어(돌문어) — `Octopus vulgaris`
60. 대문어 — `Enteroctopus dofleini`

## 감사 규칙

1. 핵심종은 학명 기준으로 한 행만 사용한다.
2. 광어/넙치, 우럭/조피볼락처럼 통칭은 `aliases`로 합친다.
3. 동일 한국명의 영문 수동 시드와 API 학명 행이 겹치면 API 학명 행을 표준으로 둔다.
4. 한국명이 없는 행은 자동으로 `needs_review` 처리한다.
5. 신규 종이 추가되어도 `FIELD 60 v1`의 분모는 바꾸지 않는다.
6. 보호종·포획금지종은 핵심·확장 도감에 승격하지 않는다.
7. 금어기·금지체장 대상종은 도감에 둘 수 있지만 상세에서 규제 정보를 항상 공개한다.

## 두족류 표준명 근거

- 국립수산과학원 수산생명자원정보: 살오징어, 참갑오징어
- 국립수산과학원 답변: 창꼴뚜기(`Uroteuthis edulis`)의 방언은 한치
- 국립수산과학원 답변: 흰꼴뚜기의 통칭은 무늬오징어
- 국립수산과학원 포획·채취 규정: 주꾸미, 낙지, 참문어
- 국립생물자원관 국가생물종목록: 대문어, 살오징어, 참갑오징어

## 후속 정리

FIELD 60 완성 범위 밖의 후속 작업은 아래와 같다.

- `extended` 44종의 종별 가이드 보강
- `needs_review` 중 국내 출현·표준명이 확인된 종을 순차 검토
- 확장 도감 후보의 지역·시즌 태그 추가
- 기존 사용자 조과가 중복 행을 참조하면 표준종으로 병합하는 별도 데이터 마이그레이션 수행

## 가이드 검수 기준

필드가 채워져 있다는 이유만으로 `reviewed` 처리하지 않는다. 핵심 60종은 아래 10개 주제를 종별로 검수하며, 이력은 `fish_guide_reviews`에서 관리한다.

1. 표준명·학명·통칭
2. 특징과 유사종 구별
3. 서식 지역·환경
4. 주요 낚시 시즌
5. 낚시 방식·미끼
6. 평균·최대 크기
7. 금어기·금지체장
8. 독성·가시·취급 주의
9. 희귀도·발견 난이도
10. 대표 이미지·출처·라이선스

상태는 `draft → source_attached → reviewed → verified` 순서로 올린다. 근거와 값이 충돌하거나 자료가 부족하면 `needs_revision`으로 되돌린다. 전체 어종의 `guide_status`는 10개 주제가 모두 `reviewed` 이상일 때만 올린다.

희귀도와 발견 난이도는 보전등급이나 개체군 통계가 아니라 앱의 편집 지수다. 희귀도는 국내 생활낚시에서의 출현 빈도와 지역성을 `1(매우 흔함)~5(희귀·국지적)`로, 발견 난이도는 접근 가능한 연안에서 일반 채비로 만날 가능성과 전문 장비·원거리 출조 필요성을 `1(쉬움)~5(전문화 필요)`로 표시한다.

읽기 전용 전체 감사 명령은 `npm run audit:core-guides`다. 종 단위 상태 승격은 10개 검수 항목이 모두 `reviewed` 이상인 경우에만 `npm run finalize:core-guides`로 수행한다.

학명 검수는 MBRIS에서 수집한 한국 표준명과 WoRMS의 `accepted`, `Species`, `marine`, `exact match` 조건을 함께 만족해야 통과한다. `npm run review:core-taxonomy`로 변경 전 결과를 보고, `-- --apply`를 붙였을 때만 검수 상태와 WoRMS 직접 출처를 저장한다.

2026-07-16 WoRMS 대조에서 점농어, 부시리, 참갑오징어의 기존 학명이 현재 accepted name과 달라 각각 `Lateolabrax spilonotus`, `Seriola lalandi`, `Acanthosepion esculentum`으로 정규화했다. 기존 학명은 `scientific_synonyms`에 보존한다.

### 검수 진행 기록

- 분류: 핵심 60종의 한국 표준명, accepted scientific name, 통칭·동의명 검수 완료
- 식별: 특징과 유사종 구별 정보 60종 검수 완료
- 서식: 분포, 서식층, 바닥 환경과 수심 정보 60종 검수 완료
- 시즌·낚시: 주요 시즌, 대표 방식과 미끼 정보 60종 검수 완료
- 크기·안전: 평균·최대 크기, 독성·가시·취급 주의 정보 60종 검수 완료
- 규제: 2026-07-01 시행 법령과 2026-05-20 해양수산부 안내 기준 60종 검수 완료
- 희귀도: 생활낚시 편집 지수 기준 희귀도·발견 난이도 60종 검수 완료
- 대표 이미지: 60종 모두 상업 이용 가능한 원본 또는 앱 소유 에셋, 출처·라이선스·저작자 표기 연결 완료
- 이미지 운영: 외부 원출처는 보존하고 표시 파일 60종을 공개 `fish-images` Storage로 미러링 완료
- 최종 상태: 60종 `guide_status=reviewed`, 600개 필드 `reviewed`, 누락·초안·수정 필요 0

### 앱 소유 대표 이미지

공개 라이선스 생체 사진을 확보하기 어려웠던 문치가자미, 참가자미, 돌가자미, 점농어는 동일한 자연사 도감 화풍으로 앱 전용 대표 이미지를 제작했다. 각 이미지는 종별 체형과 무늬 차이를 반영했으며 `Baited Brothers Original Asset`으로 기록한다. 능성어는 SAIAB 표본 사진(GBIF occurrence 1265261732, CC BY 4.0)을 사용한다.

### 2026-07-16 최종 감사

| 항목 | 결과 |
|---|---:|
| FIELD 60 종 수 | 60 |
| 필수값 누락 종 | 0 |
| 라이선스 이미지 누락 종 | 0 |
| 종별 공통 템플릿 잔존 | 0 |
| 필드 검수 행 | 600 |
| `reviewed` | 600 |
| `draft` / `source_attached` / `needs_revision` | 0 |
| `guide_status=reviewed` | 60 |
