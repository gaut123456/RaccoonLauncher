const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { setupIpcHandlers } = require('./ipc-handlers');

let mainWindow;
let ipcHandlersSetup = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '..', 'assets', 'icon.icns'),
    width: 800,
    height: 600,
    minWidth: 800,
    autoHideMenuBar: true,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contentSecurityPolicy:
        "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com",
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.maximize();

  if (!ipcHandlersSetup) {
    setupIpcHandlers(mainWindow);
    ipcHandlersSetup = true;
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }

  
});