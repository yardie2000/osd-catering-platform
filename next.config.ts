import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['xlsx'],
  // Pin the workspace root to this project. A stray package-lock.json in a parent
  // folder (D:\Downloads\files) otherwise makes Turbopack infer the wrong root,
  // which corrupts the .next build manifests (recurring app-build-manifest.json /
  // _buildManifest.js.tmp ENOENT errors on Windows).
  turbopack: { root: __dirname },
}

export default nextConfig
