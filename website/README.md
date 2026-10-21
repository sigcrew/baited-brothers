# 낚시당한 녀석들 웹사이트

Next.js App Router로 만든 공식 랜딩 페이지입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## Vercel 배포

Vercel에서 이 저장소를 연결하고 **Root Directory**를 `website`로 지정합니다. 프레임워크는 자동으로 Next.js로 감지됩니다.

배포 전에 아래 명령으로 확인합니다.

```bash
npm test
npm run typecheck
npm run build
```

## 공식 블로그

독립 블로그는 `official-blog` 폴더에서 별도 배포합니다. 소개 사이트의 `NEXT_PUBLIC_BLOG_URL`을
그 주소로 두면 헤더와 푸터의 블로그 메뉴가 공식 블로그로 연결됩니다.

예전에 소개 사이트에 있던 `/blog`, `/blog/[id]`, `/admin/blog` 주소는 공식 블로그로
영구 리다이렉트합니다.

운영자 로그인은 공식 블로그의 `/admin`에서만 사용합니다. 공개 메뉴에는 두지 않습니다.
`.env.example`을 참고해 `NEXT_PUBLIC_BLOG_URL`과 `NEXT_PUBLIC_SITE_URL`을 설정하세요.
