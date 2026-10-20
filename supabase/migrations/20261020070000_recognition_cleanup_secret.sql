-- recognition-contributions cleanup 크론이 앱 번들에 들어가는 anon 키 대신 전용
-- 유지보수 시크릿을 보내도록 바꾼다. Edge Function은 x-cleanup-secret 헤더를
-- 함수 시크릿 RECOGNITION_CLEANUP_SECRET과 상수 시간 비교한다.
--
-- 배포 전 준비(한 번):
--   1) Vault에 recognition_cleanup_secret 생성 (긴 임의 문자열)
--   2) 같은 값을 Edge Function 시크릿 RECOGNITION_CLEANUP_SECRET으로 설정
--   3) supabase functions deploy recognition-contributions
-- anon 키는 게이트웨이 verify_jwt 통과용으로 Authorization 헤더에 그대로 남긴다.

select cron.unschedule('purge-recognition-contributions');

select cron.schedule('purge-recognition-contributions','13 * * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='recognition_cleanup_project_url')||'/functions/v1/recognition-contributions',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='recognition_cleanup_anon_key'),
      'x-cleanup-secret',(select decrypted_secret from vault.decrypted_secrets where name='recognition_cleanup_secret')
    ),
    body:='{"action":"cleanup"}'::jsonb,
    timeout_milliseconds:=60000
  );
$job$);
