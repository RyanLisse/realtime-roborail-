import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages configuration
  serverExternalPackages: ['openai'],

  // Production optimizations
  output: 'standalone',
  poweredByHeader: false,
  compress: true,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate'
          }
        ]
      }
    ];
  },

  // Environment variable validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Webpack configuration for security and optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Security: Don't expose source maps in production
    if (!dev && !isServer) {
      config.devtool = false;
    }

    // Bundle analyzer for production builds
    if (!dev && process.env.ANALYZE === 'true') {
      const BundleAnalyzerPlugin = require('@next/bundle-analyzer');
      config.plugins.push(new BundleAnalyzerPlugin());
    }

    return config;
  },

  // Image optimization
  images: {
    domains: [],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Redirect configuration
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/auth/signin',
        permanent: false,
        has: [
          {
            type: 'cookie',
            key: 'authenticated',
            value: '(?<authenticated>false|undefined)',
          },
        ],
      },
    ];
  },

  // TypeScript configuration
  typescript: {
    // Ignore type errors during build (handled by CI/CD)
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Run ESLint during build
    ignoreDuringBuilds: false,
  },

  
  // API route configuration
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
    ];
  },
};

export default nextConfig;
