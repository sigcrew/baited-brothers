# Apple Auth Secret Rotation

낚시당한 녀석들은 Supabase Apple 로그인용 Client Secret JWT를 사용합니다. 이 JWT는
만료되므로 GitHub Actions가 매월 새로 생성해 Supabase Auth Provider 설정만 갱신합니다.

계정 탈퇴는 별도 서버 흐름을 사용합니다. Apple 로그인 직후 앱이 네이티브
authorization code를 인증된 `store-apple-token` Edge Function으로 전송하면, 함수가
Apple에서 refresh token을 교환·검증하고 AES-GCM으로 암호화해 service role 전용
`apple_auth_tokens` 테이블에 저장합니다. `delete-account`는 계정 데이터 삭제 전에 이
토큰을 Apple에 폐기합니다.

## GitHub Actions Secrets

- `SUPABASE_ACCESS_TOKEN`: 프로젝트 관리 권한이 있는 Supabase access token
- `SUPABASE_PROJECT_REF`: `zfezkimynicyvhmwgzoi`
- `APPLE_TEAM_ID`: Apple Developer Team ID
- `APPLE_KEY_ID`: Sign in with Apple Key ID
- `APPLE_CLIENT_ID`: `com.sigcrew.baitedbrothers`
- `APPLE_PRIVATE_KEY_BASE64`: `.p8` 파일 전체를 Base64로 인코딩한 값

GitHub Action은 Supabase Auth Provider의 만료 JWT만 갱신합니다. Edge Function
secret에 만료 JWT를 복사하지 않습니다.

## Supabase Edge Function Secrets

다음 값은 프로젝트에 한 번 등록합니다.

- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_CLIENT_ID`: fallback client ID
- `APPLE_NATIVE_CLIENT_ID`: `com.sigcrew.baitedbrothers`
- `APPLE_SERVICES_ID`: 웹 OAuth에서 별도 Services ID를 쓸 때만 등록
- `APPLE_PRIVATE_KEY`: begin/end 줄을 포함한 `.p8` 원문
- `APPLE_TOKEN_ENCRYPTION_KEY`: Base64로 인코딩한 임의의 32바이트 키

Edge Function은 토큰 교환·폐기 시점에 5분짜리 Apple Client Secret을 즉석에서
생성합니다. `APPLE_TOKEN_ENCRYPTION_KEY`를 바꾸면 기존 refresh token을 복호화할 수
없으므로, 기존 행을 재암호화하지 않는 한 절대 교체하지 않습니다.

## 배포 순서

1. `20260721094430_add_apple_auth_tokens.sql` 마이그레이션 적용
2. 위 Edge Function secrets 등록
3. `store-apple-token` 및 `delete-account` 배포
4. GitHub Actions에서 `Refresh Apple client secret` 수동 실행
5. 신규 Apple 계정 로그인 후 탈퇴하여 `appleRevocation: revoked` 확인

기존 Apple 사용자는 저장된 refresh token이 없을 수 있습니다. 이 경우 앱 데이터
삭제는 계속 진행하고 iPhone 설정에서 Apple 연결을 직접 해제하도록 안내합니다.
