# 하단 네비게이션

> Baited Brothers (낚시당한 녀석들)  
> 원칙: 탭은 **얇게**, 수집 시작(카메라)은 **명확하게**.  
> 일정 전용 탭·내 기록 탭·커뮤니티 탭은 두지 않는다.  
> 계정·로그아웃은 **프로필**, 출조 계획→완료는 **홈**.

관련 문서: [`positioning-monetization.md`](./positioning-monetization.md) · [`design-direction.md`](./design-direction.md) · [`collection-verification.md`](./collection-verification.md) · [`fishing-trips.md`](./fishing-trips.md) · [`map-view.md`](./map-view.md) · [`encyclopedia-design.md`](./encyclopedia-design.md)

---

## 1. 현재 구성 (구현됨)

```
[ 홈 ]     [ 수집 ]     [ 프로필 ]
              ↑
      (예정) 기록하기 CTA
```

| 순서 | 라벨 | 파일 | 아이콘 |
|------|------|------|--------|
| 1 | **홈** | `app/(tabs)/index.tsx` | home |
| 2 | **수집** | `app/(tabs)/encyclopedia.tsx` | book |
| 3 | **프로필** | `app/(tabs)/profile.tsx` | user |

| 탭 | 역할 |
|----|------|
| **홈** | 출조 일정: 계획(`planned`) → 완료(`done`) / 취소 |
| **수집** | 세그먼트 **도감 \| 배지 \| 카드** |
| **프로필** | 계정·로그아웃 |

---

## 2. 상세

### 2-1. 홈 = 출조 일정 허브

- 일정 전용 하단 탭 **없음** (탭 과밀·홈과 중복 방지)
- 흐름·필드는 [`fishing-trips.md`](./fishing-trips.md)

### 2-2. 수집

| 세그먼트 | 내용 |
|----------|------|
| **도감** | 어종 해금·미해금 |
| **배지** | 기본·시즌 배지 |
| **카드** | 조과 카드 앨범 |

### 2-3. 프로필

계정 정보, 로그아웃. (이후) 설정·친구 비교.

### 2-4. 기록하기 CTA (예정)

탭 아님. 카메라 수집 플로우 → [`collection-verification.md`](./collection-verification.md)

---

## 3. 탭으로 빼지 말 것

| 기능 | 둘 곳 |
|------|-------|
| 출조 일정 | **홈** |
| 도감·배지·카드 | **수집** |
| 계정·로그아웃 | **프로필** |
| 일정 전용 / 내 기록 / 피드 탭 | **안 함** |

---

## 4. 한 줄

> **홈(출조 일정) · 수집 · 프로필** (+ 기록하기 CTA).

---

## 5. 다음 액션

- [x] 수집 세그먼트 · 내 기록 제거 · 프로필 탭
- [x] 홈 = 출조 계획→완료 (일정 탭 없음)
- [ ] 기록하기 CTA → 카메라 플로우
- [ ] 카드·배지 실데이터
- [ ] 지도: 수집 > 카드 「지도로 보기」 ([`map-view.md`](./map-view.md), 후순위)
- [ ] 프로필: 설정·친구 비교 (후순위)
