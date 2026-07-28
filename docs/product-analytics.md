# 제품 사용량 계측 정책

> 적용 기준: 2026-07-21
> 목적: 무료 출시 이후 실제 사용 패턴, AI 비용, 사진 저장 부담, 재방문 구조를 판단한다.

## 1. 원칙

1. 조과·출조처럼 이미 서비스 DB에 남는 사실은 분석 이벤트로 중복 저장하지 않고 원본 테이블을 집계한다.
2. AI 실패, 후보 선택, 화면 열람처럼 원본 데이터로 복원할 수 없는 행동만 `analytics_events`에 기록한다.
3. 이벤트에는 사진, Base64, 이메일, 위치·주소·좌표, 메모, 인증 토큰을 넣지 않는다.
4. 분석 전송 실패는 사용자 기능을 막지 않는다.
5. 원본 이벤트는 최대 90일 보관하고 매일 `pg_cron`으로 삭제한다.
6. 계정 삭제 시 `auth.users` 외래키의 `ON DELETE CASCADE`로 사용자 이벤트도 함께 삭제한다.
7. 장기 보고서에는 사용자를 식별할 수 없는 일·주·월 단위 집계만 남긴다.
8. 개발자·App Review·QA 계정은 `user_profiles.analytics_excluded = true`로 지정한다. 이 값은 운영자만 변경할 수 있다.

## 2. 데이터 구조

### 기존 원본 테이블

| 원본 | 측정 항목 |
| --- | --- |
| `auth.users` | 가입자 수, 가입 코호트 |
| `user_catches` | 조과 등록자, 두 번째 조과 전환, 수집 어종, 출조별 조과 |
| `fishing_trips` | 계획·완료·취소, 계획에서 기록으로 이어진 비율 |
| `storage.objects` | 현재 사용자 사진 개수와 저장 바이트 |

### `analytics_events`

| 필드 | 설명 |
| --- | --- |
| `user_id` | 인증 사용자 ID. 계정 삭제 시 함께 삭제 |
| `session_id` | 앱 실행 프로세스 단위 임의 식별자 |
| `event_name` | 허용 목록에 포함된 이벤트 이름 |
| `properties` | 4KB 이하의 비민감·평면 JSON |
| `app_version`, `build_number`, `platform` | 오류 및 버전 비교용 |
| `occurred_at` | 서버 기록 시각 |

클라이언트는 자기 이벤트를 `INSERT`만 할 수 있다. 조회·수정·삭제 권한은 없으며 운영 집계는 Supabase Dashboard 또는 `service_role` 서버 환경에서만 수행한다.

### 장기 집계

| 테이블 | 보관 내용 |
| --- | --- |
| `analytics_daily` | 날짜·이벤트·플랫폼·앱 버전별 이벤트 수와 고유 사용자 수 |
| `analytics_monthly` | 신규 사용자, 의미 활성 사용자, 조과·출조 생성자와 생성 수 |
| `analytics_cohort_monthly` | 가입 월별 코호트 크기, 월간 재방문 사용자와 재방문율 |

세 집계 테이블에는 사용자 ID가 없고 앱 클라이언트에는 조회 권한도 없다. `private.refresh_analytics_aggregates()`가 매일 02:47에 최근 집계를 갱신한 뒤, 03:17에 90일이 지난 원시 이벤트가 삭제된다.

## 3. 이벤트 목록

| 이벤트 | 발생 시점 | 허용 속성 예시 |
| --- | --- | --- |
| `app_opened` | 로그인 상태에서 앱 활성화. 30분 이내 중복 제외 | 없음 |
| `collection_viewed` | 도감·배지·카드 세그먼트 열람 | `segment` |
| `fish_detail_viewed` | 어종 상세 열람 | `unlocked`, `catalog_order` |
| `catch_card_opened` | 조과 카드 확대 | `source` |
| `catch_flow_started` | 조과 기록 화면 진입 | `has_trip` |
| `location_choice_selected` | 위치 첨부 선택 | `choice` |
| `camera_opened` | 조과 카메라가 사용 가능한 상태가 됨 | `has_trip` |
| `photo_captured` | 촬영과 사진 최적화 완료 | `has_position` |
| `analysis_result_viewed` | AI 결과 화면 표시 | `candidate_count`, `needs_retake`, `has_error` |
| `catch_save_started` | 조과 저장 시작 | `capture_method`, `has_trip` |
| `catch_save_succeeded` | 조과 저장 완료 | `verified`, `first_discovery`, `has_trip` |
| `catch_save_failed` | 조과 저장 실패 | `stage`, `failure_kind` |
| `photo_upload_failed` | 원본·썸네일 업로드 실패 | `failure_kind` |
| `photo_library_save_succeeded/failed` | 사진 앱 저장 결과 | 실패 시 `failure_kind` |
| `permission_prompted/result` | 카메라·위치·사진 추가 권한 요청 및 결과 | `permission_kind`, `granted`, `can_ask_again` |
| `ai_analysis_started` | AI 요청 직전 | `catalog_count` |
| `ai_analysis_succeeded` | 후보 1개 이상 반환 | `duration_ms`, `candidate_count` |
| `ai_analysis_rejected` | 비어류·저품질·후보 없음 | `duration_ms`, `needs_retake` |
| `ai_analysis_failed` | 네트워크·서버·시간 초과 | `duration_ms`, `failure_kind` |
| `ai_candidate_confirmed` | AI 후보로 조과 저장 완료 | `candidate_rank`, `candidate_count` |
| `manual_species_confirmed` | 직접 검색한 어종으로 저장 완료 | `had_ai_candidates` |
| `catch_created/updated/deleted` | 조과 변경 성공 후 | 값이 아닌 `has_*`, 방식 정보만 |
| `trip_created/updated/completed/canceled/deleted` | 출조 변경 성공 후 | 값이 아닌 상태·유무 정보만 |

## 4. 핵심 지표 정의

### 월간 활성 사용자(MAU)

해당 월에 아래 중 하나를 수행한 고유 사용자다.

- 조과 등록
- 출조 생성·완료
- AI 분석
- 도감 상세 또는 조과 카드 확인

단순 백그라운드 실행은 활성 행동으로 보지 않는다.

### 월간 재방문율

```text
지난달과 이번 달 모두 의미 있는 행동을 한 사용자
÷ 지난달 의미 있는 행동을 한 사용자
```

### 90일 재방문율

첫 의미 행동 이후 61~120일 구간에 의미 행동을 다시 한 사용자 비율이다. 낚시 빈도를 고려해 1일 재방문율은 핵심 지표에서 제외한다.

### 두 번째 조과 전환율

```text
조과를 2개 이상 등록한 사용자
÷ 조과를 1개 이상 등록한 사용자
```

### 출조 계획→조과 기록 전환율

```text
조과가 1개 이상 연결된, 예정일이 지난 출조
÷ 예정일이 지난 전체 planned/done 출조
```

취소 출조는 분모에서 제외한다.

### AI 후보 확정률

```text
ai_candidate_confirmed
÷ ai_analysis_succeeded
```

직접 검색 비율은 `manual_species_confirmed ÷ (ai_candidate_confirmed + manual_species_confirmed)`로 본다.

## 5. 운영 SQL 예시

### 최근 30일 AI 퍼널

```sql
select
  event_name,
  count(*) as events,
  count(distinct user_id) as users
from public.analytics_events
where occurred_at >= now() - interval '30 days'
  and event_name like 'ai_%'
group by event_name
order by event_name;
```

### 두 번째 조과 전환율

```sql
with counts as (
  select user_id, count(*) as catch_count
  from public.user_catches
  group by user_id
)
select
  count(*) filter (where catch_count >= 2)::numeric
    / nullif(count(*) filter (where catch_count >= 1), 0) as second_catch_rate
from counts;
```

### 출조 계획→조과 기록 전환율

```sql
select
  count(distinct t.id) filter (where c.id is not null)::numeric
    / nullif(count(distinct t.id), 0) as planned_to_catch_rate
from public.fishing_trips t
left join public.user_catches c on c.trip_id = t.id
where t.status <> 'canceled'
  and t.scheduled_at < now();
```

### 현재 사용자 사진 저장량

```sql
select
  count(*) as object_count,
  coalesce(sum((metadata ->> 'size')::bigint), 0) as total_bytes
from storage.objects
where bucket_id = 'user-uploads';
```

### 운영·심사 계정 제외

아래 변경은 운영자 SQL Editor 또는 안전한 서버 환경에서만 실행한다.

```sql
update public.user_profiles
set analytics_excluded = true
where id = '<제외할 auth.users ID>';
```

계정을 제외한 뒤 `select private.refresh_analytics_aggregates();`를 운영자 권한으로 실행하면 최근 일·월·코호트 집계에 즉시 반영된다. 원시 이벤트는 보존 기간에 따라 삭제되지만 이후 새 이벤트는 DB 정책에서 거절된다.

### 저장 퍼널

```sql
select
  event_name,
  sum(event_count) as events,
  max(user_count) as daily_peak_users
from public.analytics_daily
where metric_date >= current_date - 30
  and event_name in (
    'catch_flow_started',
    'photo_captured',
    'analysis_result_viewed',
    'catch_save_started',
    'catch_save_succeeded',
    'catch_save_failed'
  )
group by event_name
order by event_name;
```

## 6. 출시 후 검토 주기

- 매주: AI 성공·거부·실패율, 저장 실패, 사진 저장량
- 매월: MAU, 월간 재방문, 두 번째 조과 전환, 사용자당 AI 사용 횟수
- 분기: 90일 재방문, 계절별 복귀, 무료 정책과 유료 기능 후보

표본이 적은 첫 4주는 비율보다 실제 사용자 흐름과 실패 사례를 우선 확인한다. 가격과 사용 한도는 최소 4~8주의 운영 데이터가 쌓인 뒤 결정한다.
