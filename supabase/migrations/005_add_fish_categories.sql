-- 낚시 대상 어류 카테고리 확장 (enum만 추가, UPDATE는 006에서)
ALTER TYPE fish_category ADD VALUE 'mullet';      -- 숭어류
ALTER TYPE fish_category ADD VALUE 'cutlassfish'; -- 갈치류
ALTER TYPE fish_category ADD VALUE 'eel';         -- 곰치류
ALTER TYPE fish_category ADD VALUE 'pufferfish';  -- 복어류
