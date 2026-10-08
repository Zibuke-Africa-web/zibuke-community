import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

export default nextConfig;
