/** @type {import('next').NextConfig} */

const securityHeaders = [

  { key: 'X-DNS-Prefetch-Control', value: 'on' },

  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },

  { key: 'X-Content-Type-Options', value: 'nosniff' },

  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  {

    key: 'Permissions-Policy',

    value: 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',

  },

  {

    key: 'Content-Security-Policy',

    value: [

      "default-src 'self'",

      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com https://www.gstatic.com",

      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      "img-src 'self' data: blob: https: http:",

      "font-src 'self' https://fonts.gstatic.com data:",

      "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://www.google-analytics.com https://www.payfast.co.za https://sandbox.payfast.co.za https://*.etenders.gov.za https://ocds-api.etenders.gov.za",

      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://www.payfast.co.za https://sandbox.payfast.co.za",

      "object-src 'none'",

      "base-uri 'self'",

      "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",

      "frame-ancestors 'self'",

    ].join('; '),

  },

]



const nextConfig = {

  output: 'standalone',

  // Repo historically had no ESLint config; disable build-blocking lint until a full config is adopted.
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Typecheck is run separately in CI/QA (`npx tsc --noEmit`).
    ignoreBuildErrors: false,
  },

  experimental: {

    serverComponentsExternalPackages: ['firebase-admin'],

    outputFileTracingIncludes: {

      '/api/**/*': ['./backend/**/*'],

    },

  },

  async headers() {

    return [

      {

        source: '/:path*',

        headers: securityHeaders,

      },

      {

        // Hashed build assets are immutable; keep long cache.

        // HTML Cache-Control is set in middleware so it overrides Next's

        // default s-maxage=31536000 (stale HTML → missing chunks → Application error).

        source: '/_next/static/:path*',

        headers: [

          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },

        ],

      },

    ]

  },

}



module.exports = nextConfig

