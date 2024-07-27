const fs = require('node:fs');
const fsPromises = require('node:fs').promises;
const path = require('node:path');
const os = require('node:os');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth, tokenUtils } = require('msmc');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const AdmZip = require('adm-zip');
const { app } = require('electron');
const { log } = require('../logger');
const fetch = require('node-fetch');
require('dotenv').config();
const Jimp = require('jimp');

const s3 = new S3Client({
    endpoint: "https://c57f2caa87a562cce9ddca89ee4d6843.r2.cloudflarestorage.com/",
    region: "auto",
    credentials: {
        accessKeyId: "fc0ea8407c458bfc2805e6d4b967c403",
        secretAccessKey: "91940992b86393743cce4b909221fcdb7c829a34808adc0ead3cb639b01fb558",
    },
});

const launcher = new Client();
const auth = new Auth("select_account");

function getJREFileName() {
    const platform = process.platform;
    const arch = os.arch();
    log(`Detected platform: ${platform}, architecture: ${arch}`);

    switch (platform) {
        case "darwin":
            return arch === "arm64" ? "jdk-21.0.3+9-jre-mac-arm.zip" : "jdk-21.0.3+9-jre-mac.zip";
        case "win32":
            return "jdk-21.0.3+9-jre-windows.zip";
        default:
            throw new Error("Unsupported platform");
    }
}

async function downloadFilesFromS3(bucketName, key, destination) {
    const params = { Bucket: bucketName, Key: key };
    try {
        const command = new GetObjectCommand(params);
        const response = await s3.send(command);
        const data = await streamToBuffer(response.Body);
        await fsPromises.mkdir(path.dirname(destination), { recursive: true });
        await fsPromises.writeFile(destination, data);
        log("File downloaded successfully.");
    } catch (error) {
        log(`Error downloading file from S3: ${error.message}`);
        throw error;
    }
}

const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });

function extractZip(source, destination) {
    const zip = new AdmZip(source);
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    zip.extractAllTo(destination, true);
    log(`File extracted successfully to: ${destination}`);

    if (process.platform === "darwin" || process.platform === "linux") {
        const javaBinaryPath = path.join(destination, "bin", "java");
        fs.chmodSync(javaBinaryPath, "755");
        log(`Set executable permissions for ${javaBinaryPath}`);
    }
}

async function checkAndDownloadMinecraft(mainWindow) {
    log("Checking for Minecraft files...");

    const userDataPath = app.getPath("userData");
    const minecraftPath = path.join(userDataPath, "raccoonlauncher", "minecraft");
    const versionPath = path.join(minecraftPath, "versions");
    const fabricFolderPath = path.join(versionPath, "fabric");
    const fabricJsonPath = path.join(fabricFolderPath, "fabric.json");

    if (!fs.existsSync(fabricJsonPath)) {
        log("fabric.json does not exist. Downloading...");

        try {
            await fsPromises.mkdir(fabricFolderPath, { recursive: true });
            await downloadFilesFromS3("raccoonlauncher", "fabric.json", fabricJsonPath);
            log("fabric.json downloaded successfully.");
            return { success: true, message: "Minecraft files installed" };
        } catch (error) {
            log(`Error: ${error.message}`);
            return {
                success: false,
                message: "Error occurred during Minecraft file download",
            };
        }
    } else {
        log("fabric.json already exists. Skipping download.");
        return { success: true, message: "Minecraft files already installed" };
    }
}

async function downloadFiles(mainWindow) {
    log("Checking for Java...");

    const userDataPath = app.getPath("userData");
    const javaPath = path.join(userDataPath, "raccoonlauncher", "java");

    if (!fs.existsSync(javaPath)) {
        log("Downloading JRE...");

        try {
            const jreFileName = getJREFileName();
            const downloadPath = path.join(userDataPath, "raccoonlauncher", jreFileName);
            await downloadFilesFromS3("raccoonlauncher", jreFileName, downloadPath);
            log("Extracting JRE...");
            extractZip(downloadPath, javaPath);
            fs.unlinkSync(downloadPath);
            log("JRE downloaded and extracted successfully");
        } catch (error) {
            log(`Error: ${error.message}`);
            return {
                success: false,
                message: "Error occurred during JRE download or extraction",
            };
        }
    } else {
        log("Java folder already exists. Skipping download.");
    }

    const minecraftResult = await checkAndDownloadMinecraft(mainWindow);
    if (!minecraftResult.success) {
        return minecraftResult;
    }

    return {
        success: true,
        message: "JRE and Minecraft files installed successfully",
    };
}

async function saveToken(token) {
    const tokenPath = path.join(app.getPath("userData"), "token.json");
    try {
        await fsPromises.writeFile(tokenPath, JSON.stringify(token));
        log("Token saved successfully");
    } catch (error) {
        log(`Error saving token: ${error.message}`);
        throw error;
    }
}

async function getToken() {
    const tokenPath = path.join(app.getPath("userData"), "token.json");
    try {
        if (fs.existsSync(tokenPath)) {
            const tokenData = await fsPromises.readFile(tokenPath, 'utf-8');
            const token = JSON.parse(tokenData);
            if (token && typeof token === 'object') {
                return token;
            }
                log("Invalid token structure in file");
                return null;
        }
        return null;
    } catch (error) {
        log(`Error reading token: ${error.message}`);
        return null;
    }
}

async function refreshTokenIfNeeded(mc) {
    const token = await getToken();
    if (token) {
        let mctoken = tokenUtils.fromMclcToken(auth, token);
        mctoken = await mc.refresh(true);
        await saveToken(mc.mclc(true));
        return mc;
    }
    return null;
}

async function extractHead(inputPath, outputPath) {
    const image = await Jimp.read(inputPath);
      const headX = 8;
    const headY = 8;
    const headSize = 8;
  
    const head = image.clone().crop(headX, headY, headSize, headSize);
  
    await head.writeAsync(outputPath);
    console.log(`Player head extracted and saved to ${outputPath}`);
  }


  async function downloadSkin(url) {
    // Define the paths
    const skinDir = path.join(app.getPath("userData"), "raccoonlauncher");
    const skinPath = path.join(skinDir, "skin.png");

    // Check if skin is already downloaded
    if (fs.existsSync(skinPath)) {
        console.log("Skin already downloaded");
        return;
    }

    // Create the directory if it doesn't exist
    try {
        await fsPromises.mkdir(skinDir, { recursive: true });
    } catch (err) {
        console.error(`Error creating directory: ${err}`);
        return;
    }

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
            },
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const buffer = await res.arrayBuffer();
        await fsPromises.writeFile(skinPath, Buffer.from(buffer));

        // Extract the player head from the skin
        const headPath = path.join(skinDir, "skinhead.png");
        await extractHead(skinPath, headPath);

        console.log("Skin downloaded and head extracted successfully.");
    } catch (err) {
        console.error(`Error downloading skin: ${err}`);
    }
}


async function launchMinecraft(opts, mainWindow) {
    let mc;
    try {
        log("Starting Minecraft launch process");
        
        let token;
        try {
            token = await getToken();
            log("Attempted to get token");
        } catch (error) {
            log(`Error getting token: ${error.message}`);
            throw error;
        }

        if (token) {
            log("Existing token found, attempting to refresh");
            try {
                mc = tokenUtils.fromMclcToken(auth, token);
                mc = await mc.refresh(true);
                await saveToken(mc.mclc(true));
                log("Token refreshed and saved");
            } catch (error) {
                log(`Error refreshing token: ${error.message}`);
                // If refresh fails, we'll try to get a new token
                token = null;
            }
        }

        if (!token) {
            log("No valid token, starting new authentication");
            try {
                const xboxManager = await auth.launch("electron");
                log("Xbox authentication completed");
                token = await xboxManager.getMinecraft();
                log("New token obtained");
                if (token?.profile?.skins?.[0]) {
                    log("Attempting to download skin");
                    await downloadSkin(token.profile.skins[0].url);
                } else {
                    log("No skin URL found in token");
                }
                
                // Validate token structure
                if (!token || typeof token.mclc !== 'function') {
                    throw new Error("Invalid token structure");
                }

                const mclcToken = token.mclc(true);
                await saveToken(mclcToken);
                log("Token structure:", JSON.stringify(mclcToken, null, 2));
                mc = tokenUtils.fromMclcToken(auth, mclcToken);
                log("New token saved and converted to MCLC format");
            } catch (error) {
                log(`Error during new authentication: ${error.message}`);
                throw error;
            }
        }

        if (!mc) {
            log("Failed to obtain a valid token");
            throw new Error("Failed to obtain a valid token");
        }

        log("Preparing launch options");
        const options = {
            ...opts,
            authorization: mc.mclc(),
            root: path.join(app.getPath("userData"), "raccoonlauncher", "minecraft"),
            javaPath: path.join(app.getPath("userData"), "raccoonlauncher", "java", "bin", "java"),
        };

        log("Launch options prepared:", JSON.stringify(options, null, 2));

        log("Starting Minecraft launch");
        try {
            launcher.launch(options);
            log("Launcher.launch called successfully");
        } catch (error) {
            log(`Error calling launcher.launch: ${error.message}`);
            throw error;
        }

        const logFilePath = path.join(app.getPath("userData"), "launcher.log");
        log(`Log file path: ${logFilePath}`);

        const logCounters = {
            progress: 0,
            data: 0,
            'package-extract': 0,
            download: 0,
            'download-status': 0
        };

        function appendLog(eventType, data) {
            try {
                if (logCounters[eventType] < 5) {
                    const logMessage = `[${eventType}] ${JSON.stringify(data, null, 2)}\n`;
                    fs.appendFileSync(logFilePath, logMessage);
                    logCounters[eventType]++;
                }
            } catch (error) {
                console.error(`Error appending to log: ${error.message}`);
            }
        }

        launcher.on("progress", (e) => {

        });
    
        launcher.on("data", (e) => {
            log("Data event received");
            appendLog("data", e);
        });
    
        launcher.on("package-extract", (e) => {
            log("Package-extract event received");
            appendLog("package-extract", e);
        });
    
        launcher.on("download", (e) => {
            log("Download event received");
            appendLog("download", e);
        });
    
        launcher.on("download-status", (e) => {
            log("Download-status event received");
            appendLog("download-status", e);
        });
    
        launcher.on("close", () => {
            log("Close event received");
            fs.appendFileSync(logFilePath, "[close] Minecraft exited\n");
            mainWindow.webContents.send("minecraft-exit");
        });

        log("Minecraft launch process completed successfully");
    } catch (error) {
        log(`Error launching Minecraft: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        mainWindow.webContents.send("launch-error", error.message);
    }
}

module.exports = {
    downloadFiles,
    launchMinecraft,
    checkAndDownloadMinecraft,
    getToken,
    saveToken,
    downloadSkin,

};