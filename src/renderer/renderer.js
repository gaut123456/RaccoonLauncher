// src/renderer/renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const launchButton = document.getElementById('launchButton');
    const statusMessage = document.getElementById('statusMessage');
    const progressBar = document.getElementById('progressBar');
    const settingsModal = document.getElementById('settingsModal');
    const ramSlider = document.getElementById('ramSlider');
    const ramValue = document.getElementById('ramValue');
    const saveSettings = document.getElementById('saveSettings');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    let maxRam = '6G';

    async function fetchServerInfos() {
        try {
            const count = await window.electronAPI.getServerInfos();
            const playerCountElement = document.getElementById('playerCount');
            if (playerCountElement) {
                playerCountElement.textContent = count.toLocaleString();
            }
        } catch (error) {
            console.error('Error fetching player count:', error);
            const playerCountElement = document.getElementById('playerCount');
            if (playerCountElement) {
                playerCountElement.textContent = 'Error';
            }
        }
    }

    fetchServerInfos();
    setInterval(fetchServerInfos, 5 * 60 * 1000);

    launchButton.addEventListener('click', async () => {
        launchButton.disabled = true;
        statusMessage.textContent = 'Preparing to launch Minecraft...';
        progressBar.style.width = '0%';
        await window.electronAPI.downloadFiles();

        try {
            await window.electronAPI.launchMinecraft({
                version: {
                    number: "1.21",
                    type: "release",
                    custom: "fabric"
                },
                memory: {
                    max: maxRam,
                    min: "2G"
                }
            });
            statusMessage.textContent = 'Minecraft is running';
            progressBar.style.width = '100%';
        } catch (err) {
            statusMessage.textContent = 'Failed to launch Minecraft';
            console.error(err);
            launchButton.disabled = false;
        }
    });

    ramSlider.oninput = function() {
        ramValue.textContent = `${this.value} GB`;
    };

    saveSettings.onclick = () => {
        maxRam = `${ramSlider.value}G`;
        settingsModal.style.display = 'none';
    };

});