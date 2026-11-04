-- 도감·배지 해금에서 위치 인증 조건을 뺀다.
-- 처음 쓰는 사람은 대부분 위치 정보가 없는 앨범 사진으로 기록하므로, 인증을 요구하면
-- 첫 기록부터 도감이 비어 보인다. 도감은 혼자 모으는 것이라 부정 이득이 없고,
-- 겨루는 랭킹(ranking_eligible)은 지금처럼 현장 인증만 받는다.

alter table public.user_catches
  alter column collection_eligible set expression as (fish_id is not null);

comment on column public.user_catches.collection_eligible is
  '도감 60종 어종이면 위치 인증 여부와 상관없이 개인 도감·배지·최대어에 반영한다. 랭킹은 ranking_eligible.';
