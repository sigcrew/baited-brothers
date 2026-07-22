# 도감 · 배지 · 카드 UI

> 수집 탭 세그먼트 디자인 기준.  
> 톤: [`design-direction.md`](./design-direction.md)

---

## 도감

- 상단 완성도 `%` + 진행 바
- 카테고리 필터 (담백한 칩)
- 행: 사진/실루엣 + 이름 + 해금/미해금
- 미해금: 실루엣·「미확인 어종」, 상세는 해금 유도 문구
- 해금: 사진·설명·최소크기

## 배지

- 2열 그리드
- 기본 배지 카탈로그 + 조과/출조 카운트 해금
- 시즌 배지는 잠금 플레이스홀더

## 카드

- 2열 앨범 (사진 위주)
- `user_catches` 기반, 없으면 빈 상태
- 탭 시 상세(사진·크기·장소·메모)

## 구현 파일

- `app/(tabs)/encyclopedia.tsx`
- `components/collection/*`
- `src/hooks/useUserCatches.ts`
- `src/data/badges.ts`
