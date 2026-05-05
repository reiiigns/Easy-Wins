import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog, type OpenDialogOptions } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// __dirname is not available in ESM — derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development" || process.env.ELECTRON_DEV === "true";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverShutdown: (() => void) | null = null;

async function startExpressServer(): Promise<void> {
  try {
    // Same relative path works in both dev and production — with asar:false, __dirname is a real disk path
    const serverPath = path.resolve(__dirname, "../../dist/server/index.js");

    const { startServer, shutdown } = await import(pathToFileURL(serverPath).href);
    serverShutdown = shutdown;
    await startServer();
    console.log("[Electron] Express server started");
  } catch (err) {
    console.error("[Electron] Failed to start Express server:", err);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#0d0d0d",
    title: "Easy Wins Project Tracker",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required for ESM preload + contextBridge in Electron 20+
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    // loadFile handles ASAR paths and Windows path encoding correctly
    mainWindow.loadFile(path.resolve(__dirname, "../index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Hide to tray on close instead of quitting
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, "../../assets/tray-icon.png");
  const raw = nativeImage.createFromPath(iconPath);
  const icon = raw.isEmpty() ? nativeImage.createEmpty() : raw.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip("Easy Wins");

  const menu = Menu.buildFromTemplate([
    {
      label: "⚡ What's my win today?",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send("tray:open-win");
      },
    },
    { type: "separator" },
    { label: "Show App", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    {
      label: "Quit",
      click: () => { isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

ipcMain.handle("dialog:open-folder", async () => {
  const options: OpenDialogOptions = {
    properties: ["openDirectory"],
    title: "Select a project folder",
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(async () => {
  await startExpressServer();
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Windows: stay alive in tray
  if (process.platform !== "darwin") return;
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    return;
  }
  mainWindow?.show();
});

app.on("before-quit", () => serverShutdown?.());

let isQuitting = false;
