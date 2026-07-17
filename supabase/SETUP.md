# Supabase 프로젝트 설정 가이드

낚시정보앱 MVP - Phase 0 인프라 구축

## ✅ 설정 완료 (Supabase MCP 적용됨)

- **프로젝트**: Baited-Brothers
- **URL**: https://zfezkimynicyvhmwgzoi.supabase.co
- **마이그레이션**: 4개 적용 완료 (initial_schema, rls_policies, storage_buckets, seed_fishes)
- **시드 데이터**: fishes 10종 입력 완료

## 3. Auth 설정 (Phase 1 준비)

1. **Authentication** → **Providers**
2. **Email** 활성화 (기본)
3. **Google**, **Apple** 소셜 로그인 설정 (아래 참고)

### Apple 로그인 설정

1. [Apple Developer Console](https://developer.apple.com/account) → **Identifiers** → App ID에 Sign in with Apple Capability 추가
2. Supabase 대시보드 → **Authentication** → **Providers** → **Apple** 활성화
3. **네이티브 iOS** 방식 사용 시 별도 Services ID/시크릿 키 불필요 (Expo Go에서 테스트 가능)

### Google 로그인 설정

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. **OAuth 2.0 Client ID** 생성 (Android/iOS/Web 각각 필요 시)
3. **Authorized redirect URIs**에 추가:
   - `https://zfezkimynicyvhmwgzoi.supabase.co/auth/v1/callback` (Supabase 콜백)
   - `baited-brothers://google-auth` (앱 딥링크)
4. Supabase 대시보드 → **Authentication** → **Providers** → **Google** 활성화
5. Client ID, Client Secret 입력
6. Supabase **Authentication** → **URL Configuration** → **Redirect URLs**에 `baited-brothers://google-auth` 추가

## 4. API 키 확인

1. **Project Settings** → **API**
2. 다음 값 복사:
   - **Project URL**
   - **anon public** (클라이언트용)
   - **service_role** (서버용, 절대 노출 금지)

## 5. Storage 버킷 (수동 생성 시)

마이그레이션 003이 실패하면 대시보드에서 수동 생성:

1. **Storage** → **New bucket**
2. `fish-images`: Public, 5MB 제한
3. `user-uploads`: Public, 5MB 제한

## 6. 환경 변수 (.env)

`.env` 파일이 프로젝트 루트에 생성됨:

```env
EXPO_PUBLIC_SUPABASE_URL=https://zfezkimynicyvhmwgzoi.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATA_GO_KR_API_KEY=공공데이터포털_해양생물종정보_API_인증키
SUPABASE_SERVICE_ROLE_KEY=service_role_키  # 시드 스크립트용, Project Settings > API
```

## 6-1. 해양생물종 API 시드 (어종 추가)

공공데이터포털 [해양생물종정보 API](https://www.data.go.kr/data/15094770/openapi.do)에서 어종 데이터를 가져와 fishes 테이블에 추가:

1. `.env`에 `SUPABASE_SERVICE_ROLE_KEY` 추가 (Project Settings > API > service_role)
2. 공공데이터포털 마이페이지 > 활용현황에서 API **요청 URL** 확인
3. URL이 기본값과 다르면 `MARINE_SPECIES_API_URL` 환경변수로 설정
4. 실행: `npm run seed:marine`

## 7. 스키마 요약

| 테이블 | 용도 |
|--------|------|
| `fishes` | 물고기 도감 (카테고리, 이름, 최소크기) |
| `user_profiles` | 사용자 프로필 (Auth 연동) |
| `user_catches` | 잡은 물고기 기록 (중복 체크용 UNIQUE) |
| `fishing_trips` | 출조 일정 (planned → done/canceled), 홈 허브 |

## 8. 다음 단계

- [x] Expo 프로젝트 초기화
- [x] Supabase 클라이언트 연동
- [x] Home 화면 + 탭 네비게이션
- [x] Phase 1: 회원가입/로그인 (이메일, Apple, Google)
- [x] Phase 2: 물고기 도감

## 9. AI 어종 후보 추천 (Claude)

`identify-fish` Edge Function은 현장 사진을 Claude 비전 모델로 분석하고,
도감 60종 안에서 최대 3개의 후보를 반환합니다. API 키는 앱의 `.env`에
넣지 않고 Supabase Function secret으로 설정합니다.

```bash
npx supabase secrets set ANTHROPIC_API_KEY=YOUR_KEY \
  --project-ref zfezkimynicyvhmwgzoi

npx supabase functions deploy identify-fish \
  --project-ref zfezkimynicyvhmwgzoi \
  --use-api
```

모델은 `claude-sonnet-5`를 사용합니다.
