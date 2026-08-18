import { betterAuth } from "better-auth"
import { getPool } from "@/lib/db"

export const auth = betterAuth({
  database: getPool(),
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.V0_DEV_APP_URL ?? process.env.V0_RUNTIME_URL)),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    // In dev/preview the app is reached over several dynamic origins: a
    // localhost port, the v0 preview iframe, and the Vercel sandbox host
    // (sb-*.vercel.run). Trust them all so the session cookie is accepted
    // regardless of which origin the browser used.
    ...(process.env.NODE_ENV === "development"
      ? [
          "http://localhost:3000",
          "https://*.vercel.run",
          "https://*.v0.build",
          // HTTPS tunnels used to reach the local dev server from a mobile
          // simulator/device. Secure cookies require HTTPS, so the tunnel
          // origin must be trusted for mobile sign-in to work. These wildcards
          // cover ngrok and cloudflared quick tunnels (whose URLs change on
          // every restart) so no env var needs updating each session.
          "https://*.ngrok-free.dev",
          "https://*.ngrok-free.app",
          "https://*.ngrok.app",
          "https://*.ngrok.io",
          "https://*.trycloudflare.com",
        ]
      : []),
    // Optional explicit override for any other https tunnel/staging origin.
    // Dev-only; set DEV_TUNNEL_URL to the full origin, e.g. https://x.example.
    ...(process.env.NODE_ENV === "development" && process.env.DEV_TUNNEL_URL
      ? [process.env.DEV_TUNNEL_URL]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
