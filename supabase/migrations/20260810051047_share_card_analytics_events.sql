-- Allow privacy-safe product events for the share-card funnel. Location text,
-- coordinates, and image data remain blocked from analytics properties.
alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check check (
    event_name in (
      'app_opened',
      'collection_viewed',
      'fish_detail_viewed',
      'catch_card_opened',
      'share_card_previewed',
      'share_card_location_changed',
      'share_sheet_opened',
      'share_card_failed',
      'catch_flow_started',
      'location_choice_selected',
      'camera_opened',
      'photo_captured',
      'analysis_result_viewed',
      'catch_save_started',
      'catch_save_succeeded',
      'catch_save_failed',
      'photo_upload_failed',
      'photo_library_save_succeeded',
      'photo_library_save_failed',
      'permission_prompted',
      'permission_result',
      'ai_analysis_started',
      'ai_analysis_succeeded',
      'ai_analysis_rejected',
      'ai_analysis_failed',
      'ai_candidate_confirmed',
      'manual_species_confirmed',
      'catch_created',
      'catch_updated',
      'catch_deleted',
      'trip_created',
      'trip_updated',
      'trip_completed',
      'trip_canceled',
      'trip_deleted'
    )
  );
