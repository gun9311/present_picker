declare global {
  interface Window {
    electron?: {
      close: () => void;
      onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
    };
    require?: (module: "electron") => { ipcRenderer: Electron.IpcRenderer };
  }

  interface UpdateInfo {
    latestVersion: string;
    message?: string;
    downloadUrl?: string;
  }
}

export {};
