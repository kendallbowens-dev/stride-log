/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow HTTPS tunnels (ngrok/cloudflared) to reach the dev server from a
  // mobile simulator/device. Next.js blocks cross-origin dev requests unless
  // the host is listed here. Wildcards cover the rotating quick-tunnel URLs.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],
}

export default nextConfig
