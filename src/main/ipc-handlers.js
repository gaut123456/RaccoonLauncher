// src/main/ipc-handlers.js
const { ipcMain } = require('electron');
const https = require('node:https');
const { launchMinecraft, downloadFiles } = require('./minecraft-launcher');

function setupIpcHandlers(mainWindow) {
    ipcMain.handle('get-server-infos', async () => {
        return new Promise((resolve, reject) => {
            https.get('https://api.mcsrvstat.us/2/hypixel.net', (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData.players.online);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    });

    ipcMain.handle('launch-minecraft', async (event, opts) => {
        return launchMinecraft(opts, mainWindow);
    });

    ipcMain.handle('download-files', async () => {
        return downloadFiles(mainWindow);
    });


    ipcMain.on('launch-progress', (event, progressData) => {
        mainWindow.webContents.send('launch-progress', progressData);
    });


}

module.exports = { setupIpcHandlers };