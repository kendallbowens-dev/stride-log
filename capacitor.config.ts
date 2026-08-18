import type { CapacitorConfig } from "@capacitor/cli"

/**
 * ⚠️ EDIT THIS before building the mobile apps: your deployed Stride Log URL.
 * Because Stride Log is server-backed (Better Auth, Neon, Strava OAuth, server
 * actions, cron), the mobile apps are a REMOTE-URL SHELL — they load your live
 * deployment rather than bundling a server, so every feature works unchanged.
 *
 * An env var (CAP_SERVER_URL) overrides it, handy for pointing a debug build at
 * a staging deployment or a LAN dev server. Examples:
 *   iOS Simulator .......... CAP_SERVER_URL="http://localhost:3000" pnpm cap:sync
 *   Android emulator ....... CAP_SERVER_URL="http://10.0.2.2:3000"  pnpm cap:sync
 *   Physical phone (LAN) ... CAP_SERVER_URL="http://192.168.1.10:3000" pnpm cap:sync
 *
 * Set DEPLOYED_URL to your real production URL for release builds. Until then
 * the default is http://localhost:3000, which works out of the box on the iOS
 * Simulator (and, via 10.0.2.2, needs the env override on the Android emulator).
 */
const DEPLOYED_URL = "https://v0-stride-log.vercel.app"
const SERVER_URL = process.env.CAP_SERVER_URL || DEPLOYED_URL

const config: CapacitorConfig = {
  appId: "app.stridelog.mobile",
  appName: "Stride Log",
  // Required by the CLI even for a remote-URL shell; holds the tiny offline
  // fallback page in `public/mobile-shell`, not the real app.
  webDir: "public/mobile-shell",
  server: {
    url: SERVER_URL,
    // Allow the WebView to navigate your own domain(s). Cleartext is enabled
    // only so a LAN dev server over http:// works; production uses https.
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    // Let the Strava OAuth redirect + your API calls resolve normally.
    allowMixedContent: true,
  },
}

export default config
