# Android 내부 테스트 배포

평소 내부 테스트 배포는 로컬에서 실행합니다.

```bash
npm run release:android:internal
```

스크립트는 다음 작업을 순서대로 수행합니다.

1. Supabase 공개 환경변수와 배포 인증 파일을 검증합니다.
2. 현재 UTC 시각을 기준으로 충돌 가능성이 낮은 `versionCode`를 생성합니다.
3. `armeabi-v7a`, `arm64-v8a`용 release AAB를 빌드합니다.
4. Fastlane으로 Google Play 내부 테스트 트랙에 업로드합니다.

## 최초 1회 설정

Ruby 3.2 이상과 lockfile에 지정된 Bundler를 준비합니다.

```bash
gem install bundler -v 2.6.9
```

다음 파일은 Git에 커밋하지 않으며 개발자 Mac에만 보관합니다.

- `.env`
- `android/keystore.properties`
- `credentials/play-submit.json`
- `android/app/upload-keystore.jks`

`android/keystore.properties.example`을 복사하고 Play에 등록된 업로드 키 정보를 입력합니다. `storeFile`은 프로젝트 기준 `app/upload-keystore.jks`처럼 지정합니다.

Play 서비스 계정 JSON은 `credentials/play-submit.json`에 저장합니다. 서비스 계정에는 해당 앱을 내부 테스트 트랙에 업로드할 수 있는 최소 권한만 부여합니다.

## versionCode

기본값은 Unix epoch를 분 단위로 변환한 값입니다. 로컬과 GitHub Actions가 같은 규칙을 사용하므로 서로 번갈아 배포해도 값이 시간순으로 증가합니다.

특정 값이 필요하면 다음과 같이 재정의할 수 있습니다.

```bash
ANDROID_VERSION_CODE=30000000 npm run release:android:internal
```

## 중요한 릴리스

GitHub Actions의 `Android internal release` 워크플로는 자동 실행되지 않습니다. 중요한 릴리스에서 GitHub Actions 화면의 **Run workflow**를 눌러 깨끗한 환경에서 수동 배포합니다.
