document.addEventListener("DOMContentLoaded", () => {
  const launchButton = document.getElementById("launchButton");
  const statusMessage = document.getElementById("statusMessage");
  const progressBar = document.getElementById("progressBar");
  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettings = document.getElementById("closeSettings");
  const ramSlider = document.getElementById("ramSlider");
  const ramValue = document.getElementById("ramValue");
  const saveSettings = document.getElementById("saveSettings");
  const playerHead = document.getElementById('playerHead');
  const profileDropdown = document.getElementById('profileDropdown');
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const skinPreviewModal = document.getElementById('skinPreviewModal');
  const skinPreviewButton = document.getElementById('skinPreviewButton');
  const closeSkinPreview = document.getElementById('closeSkinPreview');
  let maxRam = "6G";


//skin preview

skinPreviewButton.addEventListener('click', async () => {
//show modal
    skinPreviewModal.style.display = 'block';

});

closeSkinPreview.addEventListener('click', () => {
    skinPreviewModal.style.display = 'none';
});



  // Load settings when the app starts
  window.electronAPI.loadSettings().then((settings) => {
      if (settings?.maxRam) {
          maxRam = settings.maxRam;
          ramSlider.value = Number.parseInt(maxRam);
          ramValue.textContent = `${ramSlider.value} GB`;
      } else {
          console.log('Using default settings');
          maxRam = "6G";
          ramSlider.value = 6;
          ramValue.textContent = "6 GB";
      }
  });

  async function fetchServerInfos() {
      try {
          const count = await window.electronAPI.getServerInfos();
          const playerCountElement = document.getElementById("playerCount");
          if (playerCountElement) {
              playerCountElement.textContent = count.toLocaleString();
          }
      } catch (error) {
          console.error("Error fetching player count:", error);
          const playerCountElement = document.getElementById("playerCount");
          if (playerCountElement) {
              playerCountElement.textContent = "Error";
          }
      }
  }

  fetchServerInfos();
  setInterval(fetchServerInfos, 5 * 60 * 1000);

  async function login() {
      try {
          await window.electronAPI.login();
          updateAuthUI();
      } catch (error) {
          console.error('Login error:', error);
          statusMessage.textContent = `Login failed: ${error.message}`;
      }
  }

  async function updateAuthUI() {
      try {
          const isAuthenticated = await window.electronAPI.isAuthenticated();
          if (isAuthenticated) {
              loginButton.style.display = 'none';
              logoutButton.style.display = 'block';
              const skinHeadPath = await window.electronAPI.getSkinHeadPath();
              if (skinHeadPath) {
                  playerHead.src = skinHeadPath;
              }
          } else {
              loginButton.style.display = 'block';
              logoutButton.style.display = 'none';
              playerHead.src = '../assets/default-skin.jpg';
          }
      } catch (error) {
          console.error('Error updating auth UI:', error);
      }
  }

  launchButton.addEventListener('click', async () => {
    const isAuthenticated = await window.electronAPI.isAuthenticated();
    if (!isAuthenticated) {
      await handleLogin();
    }
    
    statusMessage.textContent = "Preparing to launch Minecraft...";
    progressBar.style.width = "0%";
  
    try {
      await window.electronAPI.downloadFiles();
      await window.electronAPI.launchMinecraft({
        version: {
          number: "1.21",
          type: "release",
          custom: "fabric",
        },
        memory: {
          max: maxRam,
          min: "2G",
        },
      });
    } catch (err) {
      statusMessage.textContent = `Failed to launch Minecraft: ${err.message}`;
      console.error(err);
    }
  });

  ramSlider.oninput = function () {
      ramValue.textContent = `${this.value} GB`;
  };


  // Open settings modal
  settingsButton.addEventListener("click", () => {
      settingsModal.style.display = "block";
  });

  // Close settings modal
  closeSettings.addEventListener("click", () => {
      settingsModal.style.display = "none";
  });

  // Update RAM value display when slider changes
  ramSlider.addEventListener("input", function() {
      ramValue.textContent = `${this.value} GB`;
  });

  // Save settings
  saveSettings.addEventListener("click", () => {
      maxRam = `${ramSlider.value}G`;
      window.electronAPI.saveSettings({ maxRam }).then((result) => {
          if (result.success) {
              console.log('Settings saved successfully');
          } else {
              console.error('Failed to save settings:', result.error);
          }
      });
      settingsModal.style.display = "none";
  });

  // Toggle dropdown visibility
  playerHead.addEventListener('click', () => {
      profileDropdown.classList.toggle('show');
  });

  // Login button click event
  loginButton.addEventListener('click', handleLogin);


  // Logout button click event
  logoutButton.addEventListener('click', async () => {
      try {
          await window.electronAPI.logout();
          updateAuthUI();
      } catch (error) {
          console.error('Logout error:', error);
      }
  });

  // Close dropdown when clicking outside
  window.addEventListener('click', (event) => {
      if (!event.target.matches('.player-head') && !event.target.matches('.profile-dropdown')) {
          profileDropdown.classList.remove('show');
      }
  });

  // waiting overlay
  function showLoginOverlay() {
    document.getElementById('loginOverlay').style.display = 'block';
  }
  
  function hideLoginOverlay() {
    document.getElementById('loginOverlay').style.display = 'none';
  }
  
  async function handleLogin() {
    showLoginOverlay();
    try {
      await window.electronAPI.login();
      hideLoginOverlay();
      updateAuthUI();
    } catch (error) {
      console.error('Login error:', error);
      statusMessage.textContent = `Login failed: ${error.message}`;
      hideLoginOverlay();
    }
  }

  // Initial UI update
  updateAuthUI();
});