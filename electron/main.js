// Electron main process — cross-platform desktop shell for the (server-backed)
// Next.js app. This is a "remote URL shell": it loads a running Next.js server
// (your deployed Vercel URL in production, or localhost:3000 in dev) so that
// Better Auth, Neon, Strava OAuth, server actions, and cron keep working
// exactly as they do in the browser.

const { app, BrowserWindow, shell } = require("electron")
const path = require("node:path")

const isDev = !app.isPackaged

// ⚠️ EDIT THIS before packaging: your deployed Stride Log URL. This is what
// the installed desktop app loads for every end user (they cannot set env
// vars). An ELECTRON_APP_URL env var still overrides it when set (handy for
// dev/staging builds).
const DEPLOYED_URL = "https://your-stride-log.vercel.app"

// The URL the desktop shell points at. Precedence:
//   1. ELECTRON_APP_URL  — explicit override (dev/staging, or a custom build)
//   2. dev               — localhost:3000 while running `next dev`/`next start`
//   3. production        — the hardcoded DEPLOYED_URL above
const APP_URL = isDev
  ? process.env.ELECTRON_APP_URL || "http://localhost:3000"
  : process.env.ELECTRON_APP_URL || DEPLOYED_URL

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    minHeight: 640,
    backgroundColor: "#0a0a0a",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      // Security best practices: keep the renderer sandboxed and isolated,
      // never expose Node to remote content, and route any privileged access
      // through the explicit preload bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  })

  // Avoid a white flash: only show once the first paint is ready.
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
  })

  mainWindow.loadURL(APP_URL)

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" })
  }

  // Open http(s) links that target a new window in the user's real browser,
  // rather than spawning frameless Electron windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url)
    }
    return { action: "deny" }
  })

  // Keep same-origin navigation (including OAuth callbacks back to the app)
  // inside the window; send off-origin navigations to the external browser.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const target = new URL(url)
      const appOrigin = new URL(APP_URL).origin
      // Strava's OAuth consent screen lives on a different origin but must
      // complete in-window to redirect back, so only externalize links that
      // are neither the app origin nor a known OAuth provider.
      const inAppHosts = [appOrigin]
      const oauthHosts = ["https://www.strava.com", "https://strava.com"]
      const isInApp = inAppHosts.includes(target.origin) || oauthHosts.includes(target.origin)
      if (!isInApp) {
        event.preventDefault()
        shell.openExternal(url)
      }
    } catch {
      // Non-URL navigation (e.g. mailto:) — let Electron/OS handle it.
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// Single-instance lock so re-launching focuses the existing window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()

    // macOS: re-create a window when the dock icon is clicked and none are open.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Quit when all windows are closed, except on macOS where apps stay active.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}
