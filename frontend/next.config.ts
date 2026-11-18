import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole dashboard is auth-gated client UI, so the Cache Components
  // prerender constraints bring no benefit here.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
