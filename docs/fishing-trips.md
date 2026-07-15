# 출조 일정 (fishing_trips)

> 홈 화면의 핵심 기능. 일정 전용 하단 탭은 두지 않는다.  
> 루프: **계획(planned) → 다녀오면 완료(done)** / 취소(canceled)

관련: [`navigation.md`](./navigation.md) · [`design-direction.md`](./design-direction.md)

---

## 상태

| status | 의미 |
|--------|------|
| `planned` | 예정 출조 |
| `done` | 다녀와 완료 처리 |
| `canceled` | 취소 |

## 필드

| 필드 | 필수 | 설명 |
|------|------|------|
| `spot_name` | ✅ | 낚시터 이름 (자유 텍스트) |
| `scheduled_at` | ✅ | 출조 예정 일시 |
| `memo` | — | 메모 |
| `cover_image_url` | — | 홈 히어로에 표시할 출조 커버 이미지 URL |
| `cover_image_path` | — | 사진 교체·삭제에 사용하는 Storage 객체 경로 |
| `status` | ✅ | 위 상태 |
| `completed_at` | — | 완료 처리 시각 |

## 홈 UX

1. 다가오는 일정 (`planned`) 목록
2. 일정 추가
3. 완료 / 취소
4. 최근 완료 몇 건
5. 일정 추가 시 커버 사진 선택 / 홈 히어로에서 사진 교체

가장 가까운 `planned` 일정에 커버 사진이 있으면 홈 배경으로 표시한다.
사진이 없거나 로그인 전이면 기본 대천항 이미지를 사용한다.
