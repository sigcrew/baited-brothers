export const APP_STORE_URL =
  "https://apps.apple.com/kr/app/%EB%82%9A%EC%8B%9C%EB%8B%B9%ED%95%9C-%EB%85%80%EC%84%9D%EB%93%A4/id6792683065";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sigcrew.baitedbrothers";

export function publicBlogUrl(value = process.env.NEXT_PUBLIC_BLOG_URL) {
  return (value || "https://official-blog-nine.vercel.app").replace(/\/$/, "");
}

export function websiteBlogRedirects(blog = publicBlogUrl()) {
  return [
    { source: "/blog", destination: blog, permanent: true },
    { source: "/blog/image/:postId/:file", destination: `${blog}/image/:postId/:file`, permanent: true },
    { source: "/blog/:id", destination: `${blog}/posts/:id`, permanent: true },
    { source: "/admin/blog", destination: `${blog}/admin`, permanent: true },
  ];
}

export function officialBlogSections(blog = publicBlogUrl()) {
  return [
    ["조행기", `${blog}/trip`],
    ["낚시 가이드", `${blog}/guide`],
    ["앱 소식", `${blog}/news`],
  ];
}
