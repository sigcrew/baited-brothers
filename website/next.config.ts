import type { NextConfig } from "next";

import { websiteBlogRedirects } from "./lib/links";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  redirects: async () => websiteBlogRedirects(),
};

export default nextConfig;
