# Store release 1.1.5 — 2026-09-11

User authorized public App Store and Google Play release.

## Validation
- Jest: 24 suites / 108 tests passed.
- App TypeScript check passed.
- Includes account menu reorder, shared tab bar geometry restoration, compact active indicator, and preceding search/network fixes.

## Builds
- iOS 42: 8f3fe1f6-3807-4793-a8cc-f435dbd9c99d
- iOS submission: cb70fc44-d39e-453b-9646-e7796f7feef6
- Android 10017: 8b6e5366-3dd4-4def-a1e3-345e4a7a2178
- Android 10016 build a204f2b5-e442-4c63-b187-fb12154bd6c2 was canceled because Play already used 10016 for 1.1.4.
- Google service-account submission credentials were unavailable in EAS; use authenticated Play Console upload.

## Store preparation
- Apple 1.1.5 created; release notes saved; automatic release after approval; existing screenshots and review info retained.
- Google production draft release 5 created; name 1.1.5 and Korean release notes entered.
- Public release is not yet verified. Builds and submissions are in progress.

## Progress update
- Apple 1.1.5 (42): submitted successfully, status Waiting for Review confirmed in App Store Connect.
- Apple review ID: ba6a3393-c34b-48cc-8225-5c7e5e82a11c
- Added required English release notes as well as Korean notes.
- Apple automatic release after approval is enabled.
- Play upload rejected 10017 as previously used. Library confirmed 10018 is the highest uploaded bundle (1.1.4).
- Synced EAS Android remote counter to 10018, then built 10019: 9d0dbf71-8d4d-4c10-a822-3e22cdcc49d1.
- Android 10019 build is in progress; no production rollout yet.

## Latest status
- Android 10019 build FINISHED without errors.
- Upload artifact: /private/tmp/baited-brothers-1.1.5-10019.aab
- Google Play final upload/submission blocked by Mac lock; requested user unlock. Existing draft remains release 5, notes saved.
- Next: remove failed 10017 upload from draft, upload 10019, preview and submit changes for review. Verify managed publishing / approval release behavior.

## Google Play submission completed
- Uploaded /private/tmp/baited-brothers-1.1.5-10019.aab and verified Play shows 10019 (1.1.5).
- Removed only failed 10017 draft attachment; existing published bundles retained.
- Review preview: no blocking errors; one warning about missing deobfuscation mapping file.
- Rollout: 100%, all existing target countries; no previously supported phone devices removed.
- Saved production release 5 and confirmed Send changes for review.
- Publishing overview now shows Changes in review (검토 중인 변경사항).
- Automated quick checks still running; UI states changes will be sent for review after checks succeed.
- Managed publishing is disabled, so approval does not require a separate manual publishing hold.
- Public availability is not yet confirmed for either store; both release submissions are awaiting store processing/review.
