/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TypeORM loads the sqlite3 driver with a dynamic require that Next's
  // output tracing does not follow, so the image ships node_modules instead
  // of the standalone bundle.
  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
  experimental: { esmExternals: true }
};

export default nextConfig;
