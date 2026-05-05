import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  onHighlightWin: (callback: () => void) => {
    ipcRenderer.on("tray:open-win", callback);
  },
  openProjectFolder: () => ipcRenderer.invoke("dialog:open-folder") as Promise<string | null>,
});
