/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./backend/**/*'],
    },
  },
}

module.exports = nextConfig
