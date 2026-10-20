-- All contribution access goes through the authenticated Edge API.
revoke select on public.recognition_contributions from authenticated;
drop function public.reserve_recognition_contribution(text,text,jsonb,text);
create function public.reserve_recognition_contribution(p_owner_id uuid,p_analysis_id text,p_client_request_id text,p_analysis jsonb,p_consent_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=p_owner_id; entry public.recognition_contributions; entry_id uuid:=gen_random_uuid(); saved public.user_catches;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_consent_version is distinct from 'recognition-photo-v1' then raise exception 'Current consent required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,20260910));
  select * into entry from public.recognition_contributions where user_id=owner_id and analysis_id=p_analysis_id;
  if found then return jsonb_build_object('id',entry.id,'state',entry.state,'image_path',entry.image_path,'inserted',false); end if;
  if (select count(*) from public.recognition_contributions where user_id=owner_id and consented_at>now()-interval '24 hours')>=30 then raise exception 'Daily contribution limit reached'; end if;
  select * into saved from public.user_catches where user_id=owner_id and client_request_id=p_client_request_id limit 1;
  insert into public.recognition_contributions(id,user_id,analysis_id,client_request_id,image_path,analysis,consent_version,catch_id,selected_fish_id,selected_custom_name,selected_at)
  values(entry_id,owner_id,p_analysis_id,p_client_request_id,owner_id::text||'/recognition-contributions/'||entry_id::text||'.jpg',p_analysis,p_consent_version,saved.id,saved.fish_id,saved.custom_species_name,case when saved.id is not null then now() end)
  returning * into entry;
  return jsonb_build_object('id',entry.id,'state',entry.state,'image_path',entry.image_path,'inserted',true);
end; $$;
revoke all on function public.reserve_recognition_contribution(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_recognition_contribution(uuid,text,text,jsonb,text) to service_role;

