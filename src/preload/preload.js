const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getServerInfos: () => ipcRenderer.invoke('get-server-infos'),
    downloadFiles: () => ipcRenderer.invoke('download-files'),
    launchMinecraft: (opts) => ipcRenderer.invoke('launch-minecraft', opts),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    isAuthenticated: () => ipcRenderer.invoke('is-authenticated'),
    login: () => ipcRenderer.invoke('login'),
    logout: () => ipcRenderer.invoke('logout'),
    getSkinHeadPath: () => ipcRenderer.invoke('get-skin-head-path'),
    getSkin: () => ipcRenderer.invoke('get-skin'),
});