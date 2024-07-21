const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

// Define the log file path
const logFilePath = path.join(app.getPath('userData'), 'app.log');

// Function to log messages to a file
function log(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `${timestamp} - ${message}\n`);
}

// Export the log function
module.exports = { log };
