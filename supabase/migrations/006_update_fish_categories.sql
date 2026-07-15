-- 기존 fishes 데이터 카테고리 재분류
UPDATE fishes SET category = 'mullet'
WHERE category = 'other' AND (
  name_ko ILIKE '%숭어%' OR name ILIKE '%Mugil%' OR name ILIKE '%mullet%'
);

UPDATE fishes SET category = 'cutlassfish'
WHERE category = 'other' AND (
  name_ko ILIKE '%갈치%' OR name ILIKE '%Trichiurus%' OR name ILIKE '%cutlassfish%'
);

UPDATE fishes SET category = 'eel'
WHERE category = 'other' AND (
  name_ko ILIKE '%곰치%' OR name_ko ILIKE '%뱀장어%' OR
  name ILIKE '%Conger%' OR name ILIKE '%conger%' OR name ILIKE '%eel%'
);

UPDATE fishes SET category = 'pufferfish'
WHERE category = 'other' AND (
  name_ko ILIKE '%복어%' OR name_ko ILIKE '%쥐치%' OR name_ko ILIKE '%말쥐치%' OR
  name ILIKE '%Tetraodon%' OR name ILIKE '%puffer%' OR
  name ILIKE '%Monacanth%' OR name ILIKE '%filefish%'
);
