/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // App Router is default in your project; nothing special needed here.
  // Add any flags you want under 'experimental'.
  experimental: {
    typedRoutes: true
  },

  // If you plan to use next/image with remote images, keep/update these.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'static.nike.com' },
      { protocol: 'https', hostname: 'content.runningwarehouse.com' },
      { protocol: 'https', hostname: 'www.rei.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' }
    ]
  }
};

module.exports = nextConfig;
