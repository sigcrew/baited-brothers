import assert from 'node:assert/strict';
import { test } from 'node:test';
import { officialBlogSections, publicBlogUrl, websiteBlogRedirects } from '../lib/links.ts';

test('sends the header blog menu to the official blog when no override is set', () => {
  assert.equal(publicBlogUrl(undefined), 'https://official-blog-nine.vercel.app');
  assert.equal(publicBlogUrl('https://blog.sigcrew.com/'), 'https://blog.sigcrew.com');
});

test('sends leftover intro-site blog addresses to the official blog', () => {
  const blog = 'https://official-blog-nine.vercel.app';
  assert.deepEqual(websiteBlogRedirects(blog), [
    { source: '/blog', destination: blog, permanent: true },
    { source: '/blog/image/:postId/:file', destination: `${blog}/image/:postId/:file`, permanent: true },
    { source: '/blog/:id', destination: `${blog}/posts/:id`, permanent: true },
    { source: '/admin/blog', destination: `${blog}/admin`, permanent: true },
  ]);
});

test('points intro-site readers to official blog sections', () => {
  const blog = 'https://official-blog-nine.vercel.app';
  assert.deepEqual(officialBlogSections(blog), [
    ['조행기', `${blog}/trip`],
    ['낚시 가이드', `${blog}/guide`],
    ['앱 소식', `${blog}/news`],
  ]);
});
