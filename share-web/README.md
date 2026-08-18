# 공유 스마트 링크

`https://baited-brothers-share.vercel.app/open`을 위한 정적 Vercel 프로젝트입니다.

- 앱이 설치되어 있으면 iOS Universal Links 또는 Android App Links가 앱을 엽니다.
- 앱이 설치되어 있지 않으면 이 랜딩 페이지가 열리고 OS에 맞는 스토어로 안내합니다.
- 인앱 브라우저가 Universal/App Links를 막는 경우 `앱에서 열기` 버튼이 커스텀 스킴을 시도한 뒤 스토어로 폴백합니다.

## 배포 전 확인

1. Vercel 프로젝트 도메인이 `baited-brothers-share.vercel.app`인지 확인합니다.
2. `.well-known/assetlinks.json`에는 Google Play 앱 서명 키, EAS 업로드 키, 로컬 디버그 키가 들어 있습니다. Play Console에서 앱 서명 키를 교체하면 새 지문을 함께 추가합니다.
3. 배포 후 두 검증 파일이 리디렉션 없이 JSON으로 응답하는지 확인합니다.
