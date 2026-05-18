import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: rootDir,
  },
  async redirects() {
    return [
      {
        source: "/talk/raw-school-2026",
        destination: "/talks/raw-school-2026/1",
        permanent: false,
      },
      {
        source: "/talk/raw-school-2026/:slide",
        destination: "/talks/raw-school-2026/:slide",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
