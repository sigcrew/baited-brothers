-- Refine the FIELD 60 editorial guide after a second catalog-wide review.
--
-- Fishing methods and baits are practical editorial recommendations, not
-- statutory instructions. They remain intentionally compact for the mobile UI.
-- Regulations continue to live in fish_regulations and point to the latest
-- Ministry of Oceans and Fisheries publication available for the 2026 tables.

WITH guide(name_ko, fishing_methods, recommended_baits) AS (VALUES
  ('넙치', ARRAY['다운샷','생미끼 외수질','선상 루어'], ARRAY['섀드웜','미꾸라지·전갱이 생미끼','갯지렁이']),
  ('도다리', ARRAY['원투낚시','선상 편대채비','다운샷'], ARRAY['청갯지렁이','참갯지렁이','크릴']),
  ('문치가자미', ARRAY['원투낚시','선상 편대채비','묶음추 채비'], ARRAY['청갯지렁이','참갯지렁이','오징어살']),
  ('참가자미', ARRAY['선상 가지채비','원투낚시','고패질'], ARRAY['청갯지렁이','오징어살','크릴']),
  ('돌가자미', ARRAY['원투낚시','선상 편대채비','다운샷'], ARRAY['참갯지렁이','청갯지렁이','새우']),
  ('강도다리', ARRAY['원투낚시','선상 편대채비','다운샷'], ARRAY['청갯지렁이','새우','섀드웜']),
  ('조피볼락', ARRAY['지그헤드 루어','구멍치기','선상 외줄'], ARRAY['섀드웜','오징어살','미꾸라지']),
  ('볼락', ARRAY['볼락루어','민장대 찌낚시','카드채비'], ARRAY['소형 웜','크릴','청갯지렁이']),
  ('개볼락', ARRAY['구멍치기','지그헤드 루어','찌낚시'], ARRAY['새우','청갯지렁이','소형 웜']),
  ('불볼락', ARRAY['선상 카드채비','볼락루어','외줄낚시'], ARRAY['크릴','오징어살','소형 웜']),
  ('쏨뱅이', ARRAY['구멍치기','지그헤드 루어','선상 외줄'], ARRAY['새우','오징어살','청갯지렁이']),
  ('노래미', ARRAY['구멍치기','원투낚시','지그헤드 루어'], ARRAY['청갯지렁이','크릴','소형 웜']),
  ('쥐노래미', ARRAY['갯바위 원투','선상 외줄','다운샷'], ARRAY['참갯지렁이','오징어살','섀드웜']),
  ('성대', ARRAY['선상 다운샷','타이라바','원투낚시'], ARRAY['섀드웜','새우','청갯지렁이']),
  ('임연수어', ARRAY['카드채비','선상 외줄','메탈지그'], ARRAY['크릴','오징어살','소형 메탈지그']),
  ('참돔', ARRAY['타이라바','찌낚시','카고낚시'], ARRAY['크릴','새우','참갯지렁이']),
  ('감성돔', ARRAY['반유동 찌낚시','카고낚시','원투낚시'], ARRAY['크릴','옥수수','게·새우']),
  ('돌돔', ARRAY['갯바위 원투','민장대 맥낚시','선상 외줄'], ARRAY['성게','참갯지렁이','소라·게']),
  ('벵에돔', ARRAY['전유동 찌낚시','반유동 찌낚시','빵가루 조법'], ARRAY['크릴','빵가루 반죽','홍갯지렁이']),
  ('긴꼬리벵에돔', ARRAY['전유동 찌낚시','잠길찌 조법','원거리 흘림'], ARRAY['크릴','빵가루 반죽','홍갯지렁이']),
  ('황돔', ARRAY['선상 외줄','타이라바','원투낚시'], ARRAY['새우','크릴','청갯지렁이']),
  ('농어', ARRAY['미노우 루어','바이브레이션 루어','생미끼 찌낚시'], ARRAY['미노우','새우·전갱이 생미끼','섀드웜']),
  ('점농어', ARRAY['미노우 루어','바이브레이션 루어','외수질'], ARRAY['미노우','새우 생미끼','섀드웜']),
  ('민어', ARRAY['선상 외수질','침선 외줄','원투낚시'], ARRAY['산새우','오징어살','참갯지렁이']),
  ('보구치', ARRAY['선상 외줄','백조기 채비','원투낚시'], ARRAY['청갯지렁이','오징어살','새우']),
  ('부세', ARRAY['선상 외줄','원투낚시','침선낚시'], ARRAY['참갯지렁이','새우','오징어살']),
  ('참조기', ARRAY['선상 외줄','가지채비','원투낚시'], ARRAY['청갯지렁이','오징어살','새우']),
  ('자바리', ARRAY['대물 생미끼','지깅','선상 외줄'], ARRAY['전갱이 생미끼','대형 메탈지그','오징어']),
  ('붉바리', ARRAY['타이라바','슬로지깅','생미끼 외줄'], ARRAY['새우','소형 메탈지그','전갱이 생미끼']),
  ('능성어', ARRAY['생미끼 외줄','슬로지깅','침선낚시'], ARRAY['전갱이 생미끼','오징어','메탈지그']),
  ('고등어', ARRAY['카드채비','메탈지그','찌낚시'], ARRAY['사비키','소형 메탈지그','크릴']),
  ('망치고등어', ARRAY['카드채비','메탈지그','트롤링'], ARRAY['사비키','소형 메탈지그','생미끼']),
  ('전갱이', ARRAY['아징','카드채비','찌낚시'], ARRAY['소형 웜','사비키','크릴']),
  ('방어', ARRAY['지깅','캐스팅 플러그','생미끼 흘림'], ARRAY['메탈지그','펜슬베이트','전갱이 생미끼']),
  ('부시리', ARRAY['캐스팅 플러그','지깅','생미끼 흘림'], ARRAY['펜슬베이트','메탈지그','전갱이 생미끼']),
  ('삼치', ARRAY['메탈지그 캐스팅','트롤링','선상 지깅'], ARRAY['메탈지그','미노우','생미끼']),
  ('갈치', ARRAY['텐야','선상 외줄','지깅'], ARRAY['꽁치살','갈치텐야','메탈지그']),
  ('청어', ARRAY['카드채비','선상 외줄','방파제 찌낚시'], ARRAY['사비키','크릴','오징어살']),
  ('숭어', ARRAY['훌치기','찌낚시','떡밥낚시'], ARRAY['곡물 떡밥','청갯지렁이','크릴']),
  ('가숭어', ARRAY['찌낚시','훌치기','원투낚시'], ARRAY['곡물 떡밥','청갯지렁이','크릴']),
  ('전어', ARRAY['카드채비','찌낚시','훌치기'], ARRAY['사비키','크릴','어피 바늘']),
  ('꽁치', ARRAY['카드채비','찌낚시','트롤링'], ARRAY['사비키','크릴','소형 생미끼']),
  ('쥐치', ARRAY['선상 가지채비','고패질','방파제 맥낚시'], ARRAY['조개살','오징어살','크릴']),
  ('말쥐치', ARRAY['선상 가지채비','고패질','외줄낚시'], ARRAY['조개살','오징어살','새우']),
  ('복섬', ARRAY['원투낚시','선상 가지채비','방파제 맥낚시'], ARRAY['오징어살','청갯지렁이','새우']),
  ('붕장어', ARRAY['원투낚시','선상 외줄','야간 처박기'], ARRAY['오징어살','고등어살','참갯지렁이']),
  ('꼬치고기', ARRAY['미노우 루어','메탈지그','생미끼 찌낚시'], ARRAY['미노우','소형 메탈지그','전갱이 생미끼']),
  ('학공치', ARRAY['민장대 찌낚시','저부력 찌낚시','카드채비'], ARRAY['곤쟁이','크릴','청갯지렁이']),
  ('보리멸', ARRAY['원투낚시','선상 편대채비','라이트 게임'], ARRAY['청갯지렁이','참갯지렁이','소형 웜']),
  ('양태', ARRAY['선상 다운샷','바닥 루어','원투낚시'], ARRAY['섀드웜','새우','청갯지렁이']),
  ('독가시치', ARRAY['찌낚시','민장대 맥낚시','밑밥 낚시'], ARRAY['크릴','해조류 미끼','청갯지렁이']),
  ('자리돔', ARRAY['민장대 찌낚시','카드채비','밑밥 낚시'], ARRAY['크릴','곤쟁이','어피 바늘']),
  ('살오징어', ARRAY['이카메탈','오모리그','채낚기'], ARRAY['이카메탈 스테','에기','오징어뿔']),
  ('참갑오징어', ARRAY['갑오징어 에깅','다운샷','선상 가지채비'], ARRAY['왕눈이에기','갑오징어 에기','생새우']),
  ('흰꼴뚜기', ARRAY['무늬오징어 에깅','야간 에깅','팁런'], ARRAY['에기','섈로우 에기','팁런 에기']),
  ('창꼴뚜기', ARRAY['에깅','이카메탈','야간 채낚기'], ARRAY['소형 에기','스테','오징어뿔']),
  ('주꾸미', ARRAY['선상 에기','애자 채비','다운샷'], ARRAY['왕눈이에기','애자','게 모형']),
  ('낙지', ARRAY['낙지 에기','선상 끌낚시','연안 루어'], ARRAY['게 모형','새우','조개류']),
  ('참문어', ARRAY['문어 에기','선상 끌낚시','연안 루어'], ARRAY['문어용 에기','게 모형','돼지비계·어류 미끼']),
  ('대문어', ARRAY['대형 문어 채비','선상 끌낚시','고중량 에기'], ARRAY['대형 에기','게 모형','어류 생미끼'])
)
UPDATE public.fishes AS fish
SET fishing_methods = guide.fishing_methods,
    recommended_baits = guide.recommended_baits
FROM guide
WHERE fish.name_ko = guide.name_ko
  AND fish.catalog_status = 'core';

-- Replace terse or ambiguous safety copy with actionable species-specific text.
WITH safety(name_ko, handling_cautions, toxicity) AS (VALUES
  ('조피볼락','등지느러미와 아가미덮개의 강한 가시를 접고 피시그립이나 젖은 장갑으로 다룬다. 찔린 상처는 즉시 세척한다.','가시 상처가 통증과 감염을 일으킬 수 있다. 식용 독성 정보와는 별개다.'),
  ('볼락','등지느러미와 아가미덮개 가시를 접고 젖은 장갑으로 다룬다.','가시 상처가 통증과 감염을 일으킬 수 있다. 식용 독성 정보와는 별개다.'),
  ('개볼락','머리와 등지느러미 가시가 손을 향하지 않게 피시그립으로 고정한다.','가시 상처가 통증과 감염을 일으킬 수 있다. 식용 독성 정보와는 별개다.'),
  ('불볼락','등지느러미와 아가미덮개 가시를 접고 젖은 장갑으로 다룬다.','가시 상처가 통증과 감염을 일으킬 수 있다. 식용 독성 정보와는 별개다.'),
  ('쏨뱅이','머리와 등지느러미 가시에 맨손으로 닿지 말고 집게와 두꺼운 장갑을 사용한다. 찔리면 바닷물 활동을 중단하고 의료 조언을 구한다.','가시의 독성 성분으로 강한 통증과 부종이 생길 수 있다.'),
  ('고등어','빠른 몸부림과 아가미덮개를 주의하고 잡은 즉시 피빼기·냉장한다.','고유 독성은 알려지지 않았지만 온도 관리가 나쁘면 히스타민 식중독 위험이 커진다.'),
  ('망치고등어','빠른 몸부림과 아가미덮개를 주의하고 잡은 즉시 피빼기·냉장한다.','고유 독성은 알려지지 않았지만 온도 관리가 나쁘면 히스타민 식중독 위험이 커진다.'),
  ('복섬','맨손으로 손질하거나 임의로 식용하지 않는다. 부리 모양 이빨의 물림도 주의한다.','테트로도톡신 중독 위험이 있다. 비전문가의 손질·식용을 금한다.'),
  ('독가시치','등·배·뒷지느러미 독가시에 맨손으로 닿지 말고 집게와 두꺼운 장갑을 사용한다.','지느러미 가시의 독성으로 심한 통증과 부종이 생길 수 있다.'),
  ('대문어','대형 개체는 혼자 들어 올리거나 몸에 감기게 두지 말고 강한 흡반과 부리를 주의한다.','식용 독성은 알려지지 않았지만 물림 상처와 알레르기 반응은 별도 주의한다.')
)
UPDATE public.fishes AS fish
SET handling_cautions = safety.handling_cautions,
    toxicity = safety.toxicity
FROM safety
WHERE fish.name_ko = safety.name_ko
  AND fish.catalog_status = 'core';

-- Remove generic institution home pages. Every core row already has direct
-- FishBase/SeaLifeBase and WoRMS taxon links; reviewed batches may also retain
-- direct NIFS/NIBR evidence pages.
UPDATE public.fishes
SET guide_source_urls = ARRAY(
  SELECT DISTINCT url
  FROM unnest(guide_source_urls) AS url
  WHERE url NOT IN ('https://www.mbris.kr/', 'https://www.nifs.go.kr/')
  ORDER BY url
)
WHERE catalog_status = 'core';

-- Point 2026 nationwide rules at the latest MOF publication of the same 2026
-- tables and preserve the effective period stored on each versioned row.
UPDATE public.fish_regulations
SET source_name = '해양수산부 수산자원의 금어기·금지체장 기준 알림(2026.5.20.)',
    source_url = 'https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=22&docSeq=66688&menuSeq=851',
    verified_at = now()
WHERE effective_from = DATE '2026-01-01'
  AND effective_to = DATE '2026-12-31';

WITH review_source AS (
  SELECT ARRAY[
    'https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=22&docSeq=66688&menuSeq=851',
    'https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=011189'
  ]::text[] AS urls
)
UPDATE public.fish_guide_reviews AS review
SET source_urls = CASE review.field_name
      WHEN 'regulations' THEN review_source.urls
      ELSE fish.guide_source_urls
    END,
    review_status = 'reviewed',
    review_notes = CASE review.field_name
      WHEN 'methods_and_baits'
        THEN '2026-07-20 종별 생활낚시 기준으로 편집 정규화. 지역·계절·선사 운영 방식에 따라 달라질 수 있음.'
      WHEN 'safety'
        THEN '2026-07-20 가시·이빨·독성·온도관리 위험 문구 재점검. 응급상황은 현장 의료 지침을 우선함.'
      WHEN 'regulations'
        THEN '2026-05-20 해양수산부 2026 기준표와 현행 수산자원관리법 시행령 링크 대조. 지역별 조례·고시는 출조 전 별도 확인 필요.'
      ELSE review.review_notes
    END,
    reviewer = CASE review.field_name
      WHEN 'regulations' THEN 'source-check: 해양수산부 + 국가법령정보센터'
      ELSE 'catalog editorial review'
    END,
    reviewed_at = now(),
    updated_at = now()
FROM public.fishes AS fish
CROSS JOIN review_source
WHERE review.fish_id = fish.id
  AND fish.catalog_status = 'core'
  AND review.field_name IN ('methods_and_baits','safety','regulations');

UPDATE public.fishes
SET guide_status = 'reviewed',
    guide_reviewed_at = now()
WHERE catalog_status = 'core';
