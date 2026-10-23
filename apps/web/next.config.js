//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const upstream = process.env.API_UPSTREAM_URL?.replace(/\/+$/, '');
    if (!upstream) return [];
    const url = new URL(upstream);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== upstream ||
      url.username ||
      url.password ||
      upstream === process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')
    )
      throw new Error('API_UPSTREAM_URL must be a separate API origin');
    return [{ source: '/api/:path*', destination: `${upstream}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js
};

module.exports = nextConfig;
