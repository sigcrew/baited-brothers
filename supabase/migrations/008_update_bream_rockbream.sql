-- 도미과(Sparidae) → 도미류
UPDATE fishes SET category = 'bream'
WHERE category = 'seabass' AND (
  name_ko ILIKE '%참돔%' OR name_ko ILIKE '%감성돔%' OR name_ko ILIKE '%황돔%' OR name_ko ILIKE '%청돔%' OR
  name ILIKE '%Pagrus%' OR name ILIKE '%Acanthopagrus%' OR name ILIKE '%Dentex%' OR name ILIKE '%Sparus%' OR
  name ILIKE '%Rhabdosargus%' OR name ILIKE '%sparid%'
);

-- 돌돔과(Oplegnathidae) → 돌돔류
UPDATE fishes SET category = 'rockbream'
WHERE category = 'seabass' AND (
  name_ko ILIKE '%돌돔%' OR name ILIKE '%Oplegnathus%' OR name ILIKE '%oplegnath%'
);
