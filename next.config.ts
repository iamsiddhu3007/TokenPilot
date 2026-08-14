import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint flat-config from create-next-app targets a newer line; lint runs
  // separately, not as a build gate, for now.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
