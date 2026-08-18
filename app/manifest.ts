import type { MetadataRoute } from "next"

// Web app manifest — makes RampWise installable as a PWA and provides the
// branded icons used by the mobile home screen when "Add to Home Screen" is used.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RampWise",
    short_name: "RampWise",
    description:
      "Turn your Strava runs into a training log and multi-sport load coach that tells you when to cut back or ramp up.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#0f0f0f",
    icons: [
      { src: "/icons/icon-48.webp", sizes: "48x48", type: "image/webp" },
      { src: "/icons/icon-72.webp", sizes: "72x72", type: "image/webp" },
      { src: "/icons/icon-96.webp", sizes: "96x96", type: "image/webp" },
      { src: "/icons/icon-128.webp", sizes: "128x128", type: "image/webp" },
      { src: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp", purpose: "any" },
      { src: "/icons/icon-256.webp", sizes: "256x256", type: "image/webp" },
      { src: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp", purpose: "any" },
      { src: "/app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  }
}
