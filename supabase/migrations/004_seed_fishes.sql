-- ============================================
-- fishes 시드 데이터
-- 광어, 우럭 등 초기 도감 데이터
-- ============================================

INSERT INTO fishes (name, name_ko, description, category, min_size_cm) VALUES
  ('Olive flounder', '광어', '넙치목 넙치과의 바닷물고기. 한국 연근해에서 흔히 잡히는 대표적인 넙치류.', 'flatfish', 25),
  ('Stone flounder', '돌가자미', '넙치목 가자미과. 얕은 바다의 모래나 펄 바닥에 서식.', 'flatfish', 20),
  ('Black rockfish', '우럭', '농어목 바닷돔과. 제주도와 남해안에서 많이 잡힘. 회로 인기.', 'rockfish', 25),
  ('Red seabream', '참돔', '농어목 도미과. 홍어과 구분. 고급 횟감으로 인기.', 'seabass', 30),
  ('Sea bass', '농어', '농어목 농어과. 연안과 강 하구에서 서식.', 'seabass', 28),
  ('Mackerel', '고등어', '고등어목 고등어과. 가을 제철에 맛이 좋음.', 'mackerel', 25),
  ('Horse mackerel', '전갱이', '통칭 전갱이류. 연안에서 흔히 잡힘.', 'mackerel', 20),
  ('Yellowtail', '방어', '농어목 전갱이과. 겨울철 제철 횟감.', 'seabass', 60),
  ('Filefish', '말쥐치', '쥐치목 쥐치과. 독이 있을 수 있어 주의.', 'other', 20),
  ('Pufferfish', '복어', '복어목. 독성이 있어 전문가 조리 필요.', 'other', 15);
