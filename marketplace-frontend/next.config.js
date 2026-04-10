/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow cover images hosted on R2 public CDN and other trusted domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'creators.fintigen.com',
      },
    ],
  },
};

module.exports = nextConfig;
