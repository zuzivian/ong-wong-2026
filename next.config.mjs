import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
};

export default function nextConfig(phase) {
  return {
    ...baseConfig,
    // Keep dev artifacts separate so concurrent `next build` does not break `next dev` chunk paths.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
