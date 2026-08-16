// Preload runs in an isolated context with access to a limited set of Node
// APIs. Expose only a tiny, explicit, read-only surface to the web app via
// contextBridge — never hand the renderer raw ipcRenderer or Node modules.

const { contextBridge } = require("electron")

contextBridge.exposeInMainWorld("desktop", {
  // Lets the web app detect it's running inside the desktop shell (e.g. to
  // hide install banners). Access via `window.desktop?.isElectron`.
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
