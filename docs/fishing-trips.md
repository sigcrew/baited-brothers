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
| `status` | ✅ | 위 상태 |
| `completed_at` | — | 완료 처리 시각 |

## 홈 UX

1. 다가오는 일정 (`planned`) 목록
2. 일정 추가
3. 완료 / 취소
4. 최근 완료 몇 건
