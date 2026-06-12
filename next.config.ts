import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.25", "192.168.1.25:3000"],
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
      {
        source: "/talk/aerocano",
        destination: "/talks/aerocano/1",
        permanent: false,
      },
      {
        source: "/talk/aerocano/:slide",
        destination: "/talks/aerocano/:slide",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
