/** @type {import('next').NextConfig} Owner: Agent B */
const nextConfig = {
  // camera frames are sent as base64 data URLs; allow big request bodies
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
