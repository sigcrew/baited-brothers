-- Public buckets already serve objects by known URL. Removing this broad
-- SELECT policy prevents clients from enumerating every catalog image.
drop policy if exists "fish_images_read" on storage.objects;
