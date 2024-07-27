const { ipcMain, app } = require('electron');
const https = require('node:https');
const fs = require('node:fs').promises;
const path = require('node:path');
const { launchMinecraft, downloadFiles, getToken, saveToken, downloadSkin } = require('./minecraft-launcher');
const { Auth } = require('msmc');

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



    ipcMain.handle('save-settings', async (event, settings) => {
        const userDataPath = app.getPath('userData');
        const settingsPath = path.join(userDataPath, 'settings.json');
        try {
            await fs.writeFile(settingsPath, JSON.stringify(settings));
            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('load-settings', async () => {
        const userDataPath = app.getPath('userData');
        const settingsPath = path.join(userDataPath, 'settings.json');
        try {
            const data = await fs.readFile(settingsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                const defaultSettings = { maxRam: "6G" };
                await fs.writeFile(settingsPath, JSON.stringify(defaultSettings));
                return defaultSettings;
            }
            console.error('Failed to load settings:', error);
            return null;
        }
    });

    ipcMain.handle('is-authenticated', async () => {
        const token = await getToken();
        return !!token;
    });

    ipcMain.handle('login', async () => {
        const auth = new Auth("select_account");
        try {
            const xboxManager = await auth.launch("electron");
            const token = await xboxManager.getMinecraft();
            
            if (token?.profile?.skins?.[0]) {
                await downloadSkin(token.profile.skins[0].url);
            }

            const mclcToken = token.mclc(true);
            await saveToken(mclcToken);
            
            return true;
        } catch (error) {
            console.error(`Error during login: ${error.message}`);
            throw error;
        }
    });

    ipcMain.handle('logout', async () => {
        const tokenPath = path.join(app.getPath('userData'), 'token.json');
        try {
            await fs.unlink(tokenPath);
            return true;
        } catch (error) {
            console.error(`Error during logout: ${error.message}`);
            return false;
        }
    });

    ipcMain.handle('get-skin-head-path', async () => {
        //check if raccoonlauncher folder exists if not create it

        const raccoonlauncherPath = path.join(app.getPath('userData'), 'raccoonlauncher');
        try {
            await fs.access(raccoonlauncherPath);
        } catch {
            await fs.mkdir(raccoonlauncherPath);
        }

        const skinHeadPath = path.join(raccoonlauncherPath, 'skinhead.png');
        try {            
            await fs.access(skinHeadPath);
            return skinHeadPath;
        } catch {
            return null;
        }
    });

    ipcMain.handle('get-skin', async () => {
        const skinPath = path.join(app.getPath('userData'), 'raccoonlauncher', 'skin.png');
        try {
            await fs.access(skinPath);
            return skinPath;
        } catch {
            return null;
        }
    });
}

module.exports = { setupIpcHandlers };