const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const AdmZip = require('adm-zip');
const { app } = require('electron');
const { log } = require('../logger'); // Import the logging utility
require('dotenv').config();

const s3 = new S3Client({
    endpoint: "https://c57f2caa87a562cce9ddca89ee4d6843.r2.cloudflarestorage.com/",
    region: 'auto',
    credentials: {
        accessKeyId: "fc0ea8407c458bfc2805e6d4b967c403",
        secretAccessKey: "91940992b86393743cce4b909221fcdb7c829a34808adc0ead3cb639b01fb558",
    },
});

const launcher = new Client();

function getJREFileName() {
    const platform = process.platform;
    const arch = os.arch();
    log(`Detected platform: ${platform}, architecture: ${arch}`);
    
    switch (platform) {
        case 'darwin':
            if (arch === 'arm64') {
                log('Using ARM-specific JRE for macOS');
                return 'jdk-21.0.3+9-jre-mac-arm.zip';
            }
            log('Using Intel-specific JRE for macOS');
            return 'jdk-21.0.3+9-jre-mac.zip';
        case 'win32':
            log('Using JRE for Windows');
            return 'jdk-21.0.3+9-jre-windows.zip';
        default:
            throw new Error('Unsupported platform');
    }
}

async function downloadFilesFromS3(bucketName, key, destination) {
    const params = {
        Bucket: bucketName,
        Key: key,
    };
    try {
        const command = new GetObjectCommand(params);
        const response = await s3.send(command);
        const data = await streamToBuffer(response.Body);
        
        // Ensure directory exists
        const dir = path.dirname(destination);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(destination, data);
        log('File downloaded successfully.');
    } catch (error) {
        log(`Error downloading file from S3: ${error.message}`);
        throw error;
    }
}

const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });

function extractZip(source, destination) {
    const zip = new AdmZip(source);
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    zip.extractAllTo(destination, true);
    log(`File extracted successfully to: ${destination}`);

    if (process.platform === 'darwin' || process.platform === 'linux') {
        const javaBinaryPath = path.join(destination, 'bin', 'java');
        fs.chmodSync(javaBinaryPath, '755');
        log(`Set executable permissions for ${javaBinaryPath}`);
    }
}

async function checkAndDownloadMinecraft(mainWindow) {
    log('Checking for Minecraft files...');
    mainWindow.webContents.send('launch-progress', 50);

    const userDataPath = app.getPath('userData');
    const minecraftPath = path.join(userDataPath, 'raccoonlauncher', 'minecraft');
    const versionPath = path.join(minecraftPath, 'versions');
    const fabricFolderPath = path.join(versionPath, 'fabric');
    const fabricJsonPath = path.join(fabricFolderPath, 'fabric.json');

    if (!fs.existsSync(fabricJsonPath)) {
        log('fabric.json does not exist. Downloading...');
        mainWindow.webContents.send('launch-progress', 60);

        try {
            // Ensure the directories exist
            fs.mkdirSync(fabricFolderPath, { recursive: true });

            const fileName = 'fabric.json';
            await downloadFilesFromS3('raccoonlauncher', fileName, fabricJsonPath);

            log('fabric.json downloaded successfully.');
            mainWindow.webContents.send('launch-progress', 80);

            return { success: true, message: 'Minecraft files installed' };
        } catch (error) {
            log(`Error: ${error.message}`);
            return {
                success: false,
                message: 'Error occurred during Minecraft file download',
            };
        }
    } else {
        log('fabric.json already exists. Skipping download.');
        return { success: true, message: 'Minecraft files already installed' };
    }
}

async function downloadFiles(mainWindow) {
    log('Checking for Java...');
    mainWindow.webContents.send('launch-progress', 0);

    const userDataPath = app.getPath('userData');
    const javaPath = path.join(userDataPath, 'raccoonlauncher', 'java');

    if (!fs.existsSync(javaPath)) {
        log('Downloading JRE...');
        mainWindow.webContents.send('launch-progress', 10);

        try {
            const jreFileName = getJREFileName();
            const downloadPath = path.join(userDataPath, 'raccoonlauncher', jreFileName);
            await downloadFilesFromS3('raccoonlauncher', jreFileName, downloadPath);

            log('Extracting JRE...');
            extractZip(downloadPath, javaPath);

            fs.unlinkSync(downloadPath);

            log('JRE downloaded and extracted successfully');
            mainWindow.webContents.send('launch-progress', 40);
        } catch (error) {
            log(`Error: ${error.message}`);
            return {
                success: false,
                message: 'Error occurred during JRE download or extraction',
            };
        }
    } else {
        log('Java folder already exists. Skipping download.');
        mainWindow.webContents.send('launch-progress', 40);
    }

    // Check and download Minecraft files
    const minecraftResult = await checkAndDownloadMinecraft(mainWindow);
    if (!minecraftResult.success) {
        return minecraftResult;
    }

    return {
        success: true,
        message: 'JRE and Minecraft files installed successfully',
    };
}

async function launchMinecraft(opts, mainWindow) {
    const authManager = new Auth('select_account');
    const xboxManager = await authManager.launch('electron');
    const token = await xboxManager.getMinecraft();
    const userDataPath = app.getPath('userData');
    const options = {
        ...opts,
        authorization: token.mclc(),
        root: path.join(userDataPath, 'raccoonlauncher', 'minecraft'),
        javaPath: path.join(userDataPath, 'raccoonlauncher', 'java', 'bin', 'java'),
    };

    launcher.launch(options);

    launcher.on('progress', (e) => {
        const { type, task, total, current } = e;
        const percentage = Math.round((current / total) * 100);
        mainWindow.webContents.send('launch-progress', { type, task, percentage });
    });

    launcher.on('data', (e) => {
        log(e);
    });

    launcher.on('close', () => {
        mainWindow.webContents.send('minecraft-exit');
    });
}

module.exports = { launchMinecraft, downloadFiles, checkAndDownloadMinecraft };
