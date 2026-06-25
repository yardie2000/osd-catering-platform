import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Erzeugt .next/standalone (server.js + minimale node_modules) für das
  // schlanke Docker-Produktionsimage. Betrifft nur `next build`, nicht dev.
  output: 'standalone',
  serverExternalPackages: ['xlsx'],
}

export default nextConfig
