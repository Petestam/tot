import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent folder also has a lockfile; pin tracing to this app so dev/build stay consistent.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['@neondatabase/serverless', 'ws'],
};

export default nextConfig;
