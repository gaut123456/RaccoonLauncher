const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    getServerInfos: () => ipcRenderer.invoke('get-server-infos'),
    downloadFiles: () => ipcRenderer.invoke('download-files'),
    launchMinecraft: (options) => ipcRenderer.invoke('launch-minecraft', options),
    onLaunchProgress: (callback) => ipcRenderer.on('launch-progress', callback),
    onMinecraftExit: (callback) => ipcRenderer.on('minecraft-exit', callback),
})