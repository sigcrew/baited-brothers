-- Remove a legacy encoded carriage return left at the end of the triggerfish
-- description. The visible sentence already ends with a period.
UPDATE public.fishes
SET description = regexp_replace(description, '&#xD;\s*$', '', 'i'),
    updated_at = now()
WHERE catalog_status = 'core'
  AND name_ko = '쥐치'
  AND description ~* '&#xD;\s*$';
