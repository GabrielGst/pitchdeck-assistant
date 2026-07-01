import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next.js 15 middleware buffers request bodies (default 10MB) before handing
    // them to route handlers. Pitch decks can exceed that — raise to match nginx/backend limit.
    middlewareClientMaxBodySize: 52428800, // 50MB in bytes
  },
};

export default nextConfig;
