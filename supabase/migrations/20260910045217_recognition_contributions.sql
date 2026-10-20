-- Explicit, per-photo contributions. User labels and client-reported predictions
-- are unreviewed; field/metadata verification never promotes these labels.
create table public.recognition_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id text not null check(char_length(analysis_id) between 1 and 120),
  client_request_id text not null check(char_length(client_request_id) between 1 and 120),
  image_path text not null unique,
  analysis jsonb not null check(jsonb_typeof(analysis)='object' and octet_length(analysis::text)<=8000),
  prediction_source text not null default 'client_reported' check(prediction_source='client_reported'),
  label_source text not null default 'user_selected' check(label_source='user_selected'),
  review_status text not null default 'unreviewed' check(review_status='unreviewed'),
  state text not null default 'uploading' check(state in ('uploading','ready','withdrawn')),
  consent_version text not null check(consent_version='recognition-photo-v1'),
  consented_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '89 days',
  catch_id uuid references public.user_catches(id) on delete set null,
  selected_fish_id uuid references public.fishes(id) on delete set null,
  selected_custom_name text,
  selected_at timestamptz,
  unique(user_id,analysis_id)
);
create index recognition_contributions_owner_photo on public.recognition_contributions(user_id,client_request_id);
create index recognition_contributions_expiry on public.recognition_contributions(expires_at);
alter table public.recognition_contributions enable row level security;
revoke all on public.recognition_contributions from public,anon,authenticated;
grant select on public.recognition_contributions to authenticated;
grant all on public.recognition_contributions to service_role;
create policy recognition_contributions_read_own on public.recognition_contributions for select to authenticated
using(user_id=(select auth.uid()) and state='ready' and expires_at>now());

create function public.reserve_recognition_contribution(p_analysis_id text,p_client_request_id text,p_analysis jsonb,p_consent_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); entry public.recognition_contributions; entry_id uuid:=gen_random_uuid(); saved public.user_catches;
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
revoke all on function public.reserve_recognition_contribution(text,text,jsonb,text) from public,anon;
grant execute on function public.reserve_recognition_contribution(text,text,jsonb,text) to authenticated;

create function private.link_recognition_contributions() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    update public.recognition_contributions set state='withdrawn',analysis='{}',selected_fish_id=null,selected_custom_name=null,selected_at=null
    where catch_id=old.id;
    return old;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,20260910));
  update public.recognition_contributions set catch_id=new.id,selected_fish_id=new.fish_id,
    selected_custom_name=new.custom_species_name,selected_at=now()
  where user_id=new.user_id and client_request_id=new.client_request_id and state<>'withdrawn' and expires_at>now();
  return new;
end; $$;
revoke all on function private.link_recognition_contributions() from public,anon,authenticated;
create trigger link_recognition_contributions after insert or update of fish_id,custom_species_name on public.user_catches
for each row execute function private.link_recognition_contributions();
create trigger withdraw_recognition_contributions before delete on public.user_catches
for each row execute function private.link_recognition_contributions();

-- Includes orphaned uploads after an interrupted submission. Storage bytes are
-- removed via the Storage API, never by deleting storage.objects metadata.
create function public.recognition_cleanup_paths() returns table(image_path text)
language sql security definer set search_path='' as $$
  select c.image_path from public.recognition_contributions c
  where c.expires_at<=now() or c.state='withdrawn' or (c.state='uploading' and c.consented_at<now()-interval '1 hour')
  union
  select o.name from storage.objects o left join public.recognition_contributions c on c.image_path=o.name
  where o.bucket_id='user-uploads' and o.name like '%/recognition-contributions/%' and c.id is null
    and o.created_at<now()-interval '1 hour'
  limit 100;
$$;
revoke all on function public.recognition_cleanup_paths() from public,anon,authenticated;
grant execute on function public.recognition_cleanup_paths() to service_role;

comment on table public.recognition_contributions is 'Explicitly consented photos for internal recognition review, not automatic training. Labels unreviewed. Available for 89 days, hourly cleanup keeps normal retention under 90 days. Account deletion uses existing user-uploads cleanup.';

create extension if not exists pg_net with schema extensions;
-- The anon project JWT authorizes only the bounded expired-data cleanup action.
-- Deployment provisions this public credential in Vault, never in app source.
select cron.schedule('purge-recognition-contributions','13 * * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='recognition_cleanup_project_url')||'/functions/v1/recognition-contributions',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='recognition_cleanup_anon_key')),
    body:='{"action":"cleanup"}'::jsonb,
    timeout_milliseconds:=60000
  );
$job$);
