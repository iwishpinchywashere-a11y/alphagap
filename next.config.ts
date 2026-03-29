import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Vercel — needed for better-sqlite3 native bindings
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
