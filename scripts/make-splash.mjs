import { createRequire } from "node:module"

// Reuse the sharp binary that ships with @capacitor/assets so we don't add a dep.
const require = createRequire(
  new URL("../node_modules/.pnpm/@capacitor+assets@3.0.5/node_modules/@capacitor/assets/", import.meta.url),
)
const sharp = require("sharp")

const SIZE = 2732
const BG = { r: 15, g: 15, b: 15, alpha: 1 } // #0f0f0f
// Logo occupies ~28% of the canvas width — a comfortable splash proportion.
const LOGO = Math.round(SIZE * 0.28)

const logo = await sharp("build/icon.png").resize(LOGO, LOGO, { fit: "contain" }).toBuffer()

for (const out of ["assets/splash.png", "assets/splash-dark.png"]) {
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(out)
  console.log("wrote", out, `${SIZE}x${SIZE}`)
}
