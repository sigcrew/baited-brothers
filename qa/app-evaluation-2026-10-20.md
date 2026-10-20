# 낚시당한 녀석들 앱 평가 (2026-10-20)

범위: 작업 트리 전체(커밋되지 않은 변경 포함), iOS 시뮬레이터(iPhone 16 Pro, Debug 빌드, 로그인 없음 = `__DEV__` 우회 상태) 실사용, Jest/tsc 실행, Supabase 마이그레이션·Edge Function 검토.

## 종합 점수

| 영역 | 점수 | 한 줄 평 |
| --- | --- | --- |
| 조과 기록 파이프라인 (record/queue/identify-fish) | 5.5 / 10 | 멱등성·로컬 큐·EXIF 제거는 잘 되어 있으나, 재시도 무한 루프와 포그라운드/백그라운드 경쟁, 이번 diff의 resume 회귀가 있음 |
| 지도·출조·일지 | 6 / 10 | 도메인 로직은 탄탄하지만 알림 취소 레이스, 마커 재렌더링 폭주, 탭 전환 후 데이터 미갱신 |
| 수집·프로필·인증·백엔드 보안 | 6 / 10 | RLS·삭제·Apple 토큰 처리는 평균 이상. 다만 `verified` 조과 위조와 공개 버킷 쓰기가 열려 있음 |
| 디자인/UX (시뮬레이터) | 7 / 10 | 홈·지도·수집 화면 완성도 높음. 회원가입 화면만 다른 앱처럼 보임 |
| 레포 위생/빌드 | 4 / 10 | `.git` 1.1GB, 타입체크 실패(앱 코드 외), 1.3GB 미추적 파일, 루트에 스크린샷/ipa 방치 |

**전체: 6 / 10.** 출시 중인 1.1.5 기준으로 "동작은 하지만, 랭킹/인증의 신뢰성과 장기 유지보수성에 구조적 부채가 쌓인 상태". 아래 P0 4건은 다음 스토어 릴리스 전에 막는 것을 권장.

## 실행 결과

| 항목 | 결과 |
| --- | --- |
| Xcode Debug 빌드 | 성공 (320초, 경고 1,416건, 모두 Pods) |
| `tsc --noEmit` | 실패 99건. **앱 코드(app/src/components) 0건**, `official-blog/` 87, `website/` 7, `scripts/` 4, `supabase/` 1 |
| `jest` 전체 | 24 suites 중 3 실패(타임아웃 5s). 단독 재실행 시 모두 통과 → 빌드 부하에 취약한 flaky 테스트 |
| 시뮬레이터 | 홈/일지/지도/수집/프로필/로그인/회원가입/카메라 화면 정상 진입 |

## P0 — 릴리스 전 수정 권장

1. **클라이언트가 `verification_status='verified'` 조과를 직접 INSERT 가능.** `protect_catch_verification_fields` 트리거는 `captured_at`이 있거나 `photo_library`일 때만 `pending`으로 강제한다(`supabase/migrations/20260730031351_v1_core_loop_data_model.sql:100`). `capture_method='development_upload'` + 위치 null 조합은 CHECK 제약(`20260721082750:26-31`)도 통과한다. anon 키 + 본인 JWT만 있으면 도감 해금·배지·현장 인증 스탬프를 위조할 수 있다. 트리거에서 service_role이 아니면 무조건 `pending`/`general_record`로 덮고, `development_upload` 분기를 CHECK에서 제거할 것.
2. **공개 버킷 `fish-images`에 모든 인증 사용자가 업로드 가능.** `fish_images_admin_write` 정책(`003_storage.sql:33-36`)이 한 번도 드롭되지 않았다. 외부 이미지 호스팅/피싱에 악용 가능. 정책 삭제.
3. **백그라운드 AI 분석 무한 재시도 + 쿼터 소진.** `PendingCatchLifecycle.tsx:30-43,142-169`의 `markRetry`는 시도 횟수 상한이 없고 종료 상태도 없다. `identify-fish`는 Claude 호출 전에 쿼터를 차감하므로(`index.ts:440-466`) 영원히 실패하는 사진 한 장이 하루 30회 쿼터를 다 쓴다. `attemptCount` 상한 + `failed_terminal` 상태 추가, 4xx/쿼터 오류는 재시도 금지.
4. **이번 미커밋 diff의 resume 회귀.** `app/record.tsx:465-476`이 `!pending.recognitionAnalysis`일 때만 재분석하도록 바뀌었고, `PendingCatchLifecycle.tsx:69`는 실패해도 `recognitionAnalysis`를 먼저 기록한다. 결과적으로 실패한 분석을 이어가면 후보도 없고 "다시 시도" 버튼도 안 뜨는 빈 리뷰 화면이 나온다.

## P1 — 다음 스프린트

- **포그라운드 저장과 백그라운드 워커가 같은 job을 동시에 처리** (`record.tsx:800-805` vs `PendingCatchLifecycle.tsx:188-218`). DB 유니크 인덱스 덕에 중복 행은 없지만, 사진 변형을 두 번 업로드하고 백그라운드가 로컬 파일을 지우는 순간 포그라운드는 "저장 실패"를 띄운다. 큐에 `lockedBy` 같은 소유권 필드 필요.
- **분석 중 다시 찍기/언마운트 시 취소 없음** (`record.tsx:279-336`). 사진 A의 결과가 사진 B에 붙는다.
- **출조 알림 취소 레이스.** `tripNotifications.ts:65-73,115-143`이 AsyncStorage 맵을 락 없이 read-modify-write하고, `useFishingTrips()`가 8개 화면에서 독립적으로 마운트돼 동시에 sync를 돌린다. 삭제된 출조의 알림이 울릴 수 있다. 식별자가 이미 결정적(`trip-reminder:${id}`)이므로 맵 없이 무조건 cancel하면 끝.
- **지도 마커 `tracksViewChanges` 미설정** (`FishingMap.native.tsx:193-262`). 조과 수백 건이면 팬/줌마다 전체 재스냅샷 + O(n²) 클러스터링.
- **지도 탭이 포커스 시 refetch하지 않음.** 조과를 기록해도 앱 재시작 전엔 지도에 안 나온다 (홈 탭은 `useFocusEffect`로 처리).
- **세션이 평문 AsyncStorage에 저장** (`src/lib/supabase.ts:35-39`). `expo-secure-store` 플러그인은 설정돼 있으나 어디서도 import하지 않는다.
- **Google 로그인이 implicit flow + 커스텀 스킴 fragment** (`AuthContext.tsx:133-161`). Android에서 스킴 가로채기 가능. PKCE(`flowType:'pkce'` + `exchangeCodeForSession`)로 전환.
- **AppState ↔ `startAutoRefresh/stopAutoRefresh` 미연결.** 장시간 백그라운드 후 첫 요청이 만료 토큰으로 나가 간헐적 401.
- **Apple 재로그인 시 이름이 빈 문자열로 덮임** (`AppleSignInButton.tsx:37-51`, `fullName` 각 필드 null인데 객체는 truthy).
- **계정 삭제 순서.** 스토리지를 먼저 지우고 `auth.admin.deleteUser`를 호출(`delete-account/index.ts:117-127`). 후자가 실패하면 사진만 사라진 계정이 남는다.
- **`recognition-contributions` cleanup이 anon 키로 호출 가능** (`index.ts:19-24`, JWT 서명 미검증). 비용/DoS 레버.
- **`marine-conditions`가 함수 내부에서 Authorization을 검사하지 않음.** 실제로 로그인 없는 dev 세션에서도 데이터가 내려왔다(anon JWT로 통과). 게이트웨이 `verify_jwt`에만 의존하는 유료 API 프록시.
- **`record` 라우트에 인증 가드 없음.** `baited-brothers://record` 딥링크로 비로그인 상태에서도 카메라 화면이 열린다(`app/_layout.tsx` Stack, `record.tsx`에 Redirect 없음). 저장 시점에야 실패.
- **비밀번호 재설정 플로우 부재.** `resetPasswordForEmail` 호출이 코드베이스에 없다. 이메일 가입자는 비밀번호를 잊으면 복구 불가.
- **라이브러리 사진 GPS를 위해 전체 사진 보관함 권한을 추가로 요청** (`photoMetadata.ts:87-101`). PHPicker EXIF로 대부분 해결되는데 App Review 리스크를 키운다.
- **Android는 `ACCESS_MEDIA_LOCATION`이 차단돼 라이브러리 사진이 절대 `metadata_verified`가 될 수 없는데** UI는 모든 플랫폼에서 위치 인증을 약속한다(`record.tsx:1457-1479`).

## 시뮬레이터에서 직접 본 것

- **지도 바텀시트 접힌 상태에서 "이 장소로 출조 계획" 버튼이 탭바 뒤에 가려짐.** 시트를 올려야 보인다. 스냅 포인트 또는 `MAP_TAB_BAR_HEIGHT` 보정이 접힌 상태엔 적용되지 않음.
- **Apple Maps 법적 고지("법적 정보")가 탭바 아래 깔림.** 지도 탭 좌하단. Apple은 attribution 가림을 리젝 사유로 본다. `legalLabelInsets` 또는 `mapPadding` 필요.
- **회원가입 화면이 다른 앱처럼 보임.** 로그인은 필드 저널 테마(틸, Black Han Sans, 로고)인데 회원가입은 파란 둥근 버튼, 시스템 폰트, 로고·약관 링크 없음. 가입 시 이용약관/개인정보 동의 안내도 없다.
- **로그인 화면에 뒤로가기 없음.** 홈에서 push됐는데 닫는 수단이 스와이프뿐.
- **24H 전망 카드가 현재 시각(12:39)보다 이전인 12:00부터 시작**, 조석 스트립은 이미 지난 만조/간조를 보여주고 "다음 만조"는 내일로 점프. 기기 TZ와 KST 포맷이 섞여 있다(`map.tsx:1087-1101` vs `marineTides.ts`).
- 수집 탭 "2/60"은 dev 전용 가짜 조과 픽스처(`encyclopedia.tsx:89-141`)이고 프로필은 0으로 나와 dev에서도 화면끼리 어긋난다. 프로덕션엔 영향 없지만 픽스처가 DB 타입과 이미 어긋나기 시작함.
- 홈·일지·수집·프로필의 빈 상태 카피와 타이포그래피는 완성도가 높다.

## 구조/유지보수

- `app/record.tsx` 1,563줄(useState 약 20개, 같은 9개 상태 리셋이 5곳에 복붙), `app/(tabs)/map.tsx` 1,210줄. 둘 다 리듀서 기반 훅 + 화면 분리 없이는 테스트 불가.
- 데이터 레이어 없음. `useUserCatches()` 5곳, `useFishingTrips()` 8곳에서 각각 전체 fetch + 서명 URL 생성. 콜드 스타트에 같은 쿼리가 수 회 나간다. React Query 또는 단일 Provider 권장.
- 중복 로직: `isKoreaCoordinate` 3벌 + 서버 1벌, 카드 번호 해시가 아카이브(`% 999 + 1`)와 공유 카드(`% 1000`)에서 달라 같은 조과가 다른 번호를 받음, 탭바 높이 상수 2벌.
- 죽은 코드: `src/lib/catchVerification.ts`(테스트만 import), `share-preview` 라우트(가짜 데이터, 프로덕션 Stack에 등록됨), `development_upload` enum, `user_profiles.display_name`(이메일로 시드되고 앱은 쓰지 않음).
- 새로 추가된 파일 일부(`photo-contributions.tsx`, `recognitionContributions.ts`, `RecognitionContributionCard.tsx`)가 한 줄 압축 스타일로 작성돼 리뷰가 불가능. 커밋 전 Prettier.

## 테스트

- 108개 테스트 중 대부분이 순수 헬퍼와 "연속 터치 방지" 테스트. `record.tsx`, `map.tsx`, `AuthContext`, `tripNotifications.ts`, `useUserCatches`에는 테스트가 없다. Edge Function(Deno)과 RLS(pgTAP) 테스트는 0건이라 P0 1·2번은 테스트 한 개면 잡혔을 문제.
- `scripts/search-places.test.cjs`는 jest testMatch에 안 잡혀 한 번도 실행되지 않는다.
- 3개 suite가 5초 타임아웃에 걸릴 만큼 느리다(RN 렌더 테스트). `testTimeout` 상향 또는 모킹 범위 축소.

## 레포 위생

| 항목 | 상태 |
| --- | --- |
| `.git` 크기 | 1.1 GB (영상 4개 80MB, 35MB HTML, 폰트 18MB가 히스토리에 포함) |
| 미추적 대용량 | `official-blog/` 900MB, `website/` 391MB, `.tmp/` 289MB, `store-assets/meta-ads/` 92MB |
| 루트 잡동사니 | 스크린샷 PNG 11장, `.apk/.aab/.ipa` 6개 (gitignore엔 있으나 폴더에 방치) |
| 미커밋 변경 | 33 파일, +2,456 / -315, 버전 1.1.4→1.1.5 범프 포함 |

`official-blog/`와 `website/`가 앱 tsconfig의 `include: **/*.ts(x)`에 잡혀 `npm run typecheck`가 항상 실패한다. 별도 레포로 분리하거나 `exclude`에 추가.

## 작업 환경 메모

- 이 프로젝트의 iOS Debug 빌드는 `expo-dev-client`가 없는 순수 RN 디버그 빌드라 번들러가 `localhost:8081`에 고정된다. 같은 시뮬레이터에서 DearMap Metro가 8081을 점유 중이면 이 앱이 DearMap 번들을 받아 `ExpoCrypto` 오류로 죽는다. 이번 평가는 8082 Metro + `RCT_jsLocation` 기본값으로 우회했고, 평가 후 원복했다.
