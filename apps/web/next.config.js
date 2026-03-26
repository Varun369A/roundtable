/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arivarangam/types'],
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  async redirects() {
    return [
      {
        source: '/auth/verify-email',
        destination: '/verify-email',
        permanent: false,
      },
      {
        source: '/auth/reset-password',
        destination: '/reset-password',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ]
  },
  async headers() {
    return [
      // ── Workspace: needs COOP + COEP for WebContainers (SharedArrayBuffer) ──
      {
        source: '/workspace/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy',  value: 'credentialless' },
          { key: 'X-Content-Type-Options',        value: 'nosniff' },
          // SAMEORIGIN instead of DENY — workspace renders preview iframes
          { key: 'X-Frame-Options',               value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection',              value: '1; mode=block' },
          { key: 'Referrer-Policy',               value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',            value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              // WebContainer connects to npm registry + its own CDN
              "connect-src 'self' https://api.arivarangam.com wss: ws: https://registry.npmjs.org https://*.npmjs.org https://*.webcontainer.io https://*.webcontainer-api.io",
              // Allow WebContainer preview iframes (served from *.local-credentialless.webcontainer.io)
              "frame-src 'self' blob: https://*.webcontainer-api.io https://*.local-credentialless.webcontainer.io https://*.staticblitz.com",
              "worker-src 'self' blob:",
              "media-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
      // ── All other routes ─────────────────────────────────────────────────────
      {
        source: '/((?!workspace).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.arivarangam.com https://www.google-analytics.com https://api.razorpay.com wss: ws:",
              "frame-src https://checkout.razorpay.com https://api.razorpay.com",
              "media-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
