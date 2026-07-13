/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No ESLint config is shipped with this app; don't block builds on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
