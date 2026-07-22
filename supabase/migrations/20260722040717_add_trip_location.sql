-- A trip created from the map keeps the exact private coordinate used to
-- resolve nearby tide and water-temperature observations.
ALTER TABLE public.fishing_trips
  ADD COLUMN spot_lat NUMERIC(10, 7),
  ADD COLUMN spot_lng NUMERIC(10, 7);

ALTER TABLE public.fishing_trips
  ADD CONSTRAINT fishing_trips_spot_coordinates_pair
  CHECK (
    (spot_lat IS NULL AND spot_lng IS NULL)
    OR (spot_lat BETWEEN -90 AND 90 AND spot_lng BETWEEN -180 AND 180)
  );

COMMENT ON COLUMN public.fishing_trips.spot_lat IS
  'Private latitude selected by the owner for trip planning.';
COMMENT ON COLUMN public.fishing_trips.spot_lng IS
  'Private longitude selected by the owner for trip planning.';
