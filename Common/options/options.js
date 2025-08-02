// options.js

// --- DOM Elements ---
const form = document.getElementById('settings-form');
const themeToggle = document.getElementById('theme-toggle');
const statusDiv = document.getElementById('save-status');
const saveButton = document.getElementById('save-button');
const siteEnableToggle = document.getElementById('site-enable-toggle');
const currentHostnameSpan = document.getElementById('current-hostname');

// --- Global State ---
let currentHostname = '';

// --- Default Settings ---
const defaults = {
    duration: 500,
    modifier: 'shiftKey',
    theme: 'light',
    closeKey: 'Escape',
    width: '90vw',
    height: '90vh',
    disabledSites: [] // Now an array of hostnames
};

/**
 * Applies the selected theme (light/dark) to the options page.
 * @param {string} theme - The theme to apply ('light' or 'dark').
 */
function applyTheme(theme) {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    themeToggle.checked = theme === 'dark';
}

/**
 * Saves the general settings (not the site toggle).
 * @param {Event} e - The form submission event.
 */
function saveOptions(e) {
  e.preventDefault();
  // We only save the general settings here. The site toggle is saved separately.
  const generalSettings = {
    duration: document.getElementById('duration').value,
    modifier: document.getElementById('modifier').value,
    theme: themeToggle.checked ? 'dark' : 'light',
    closeKey: document.getElementById('closeKey').value || 'Escape',
    width: document.getElementById('width').value,
    height: document.getElementById('height').value
  };

  // Get the existing disabledSites array to merge with general settings
  chrome.storage.local.get('disabledSites').then(data => {
      const fullSettings = {
          ...generalSettings,
          disabledSites: data.disabledSites || []
      };

      chrome.storage.local.set(fullSettings).then(() => {
        statusDiv.textContent = 'Settings Saved!';
        statusDiv.style.color = 'var(--success-color)';
        saveButton.textContent = 'Saved!';

        setTimeout(() => {
            statusDiv.textContent = '';
            saveButton.textContent = 'Save Settings';
        }, 2000);
      }, (error) => {
        statusDiv.textContent = `Error: ${error}`;
        statusDiv.style.color = 'var(--error-color)';
      });
  });
}

/**
 * Handles the logic for the site-specific enable/disable toggle.
 */
function handleSiteToggle() {
    if (!currentHostname) return;

    chrome.storage.local.get({ disabledSites: [] }).then(data => {
        let disabledSites = data.disabledSites;
        const isCurrentlyDisabled = disabledSites.includes(currentHostname);

        if (siteEnableToggle.checked) { // User wants to ENABLE it
            if (isCurrentlyDisabled) {
                // Remove it from the disabled list
                disabledSites = disabledSites.filter(site => site !== currentHostname);
            }
        } else { // User wants to DISABLE it
            if (!isCurrentlyDisabled) {
                // Add it to the disabled list
                disabledSites.push(currentHostname);
            }
        }
        
        // Save the updated list back to storage
        chrome.storage.local.set({ disabledSites });
    });
}


/**
 * Restores all saved settings from storage and populates the form and toggle.
 */
function restoreOptions() {
  // First, get the current tab's info
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0] && tabs[0].url) {
        try {
            const url = new URL(tabs[0].url);
            // Ignore chrome://, about:, etc.
            if (url.protocol.startsWith('http')) {
                 currentHostname = url.hostname;
                 currentHostnameSpan.textContent = url.hostname;
            } else {
                currentHostnameSpan.textContent = 'this page';
                document.querySelector('.site-toggle-container').style.display = 'none';
            }
        } catch (e) {
            console.warn("Could not parse URL for current tab:", tabs[0].url);
            currentHostnameSpan.textContent = 'this page';
            document.querySelector('.site-toggle-container').style.display = 'none';
        }
    }

    // Now get all settings from storage
    chrome.storage.local.get(defaults).then(items => {
        // Populate general settings
        document.getElementById('duration').value = items.duration;
        document.getElementById('modifier').value = items.modifier;
        document.getElementById('closeKey').value = items.closeKey;
        document.getElementById('width').value = items.width;
        document.getElementById('height').value = items.height;
        applyTheme(items.theme);

        // Set the site-specific toggle
        if (currentHostname) {
            const isSiteDisabled = items.disabledSites.includes(currentHostname);
            siteEnableToggle.checked = !isSiteDisabled;
        }
    });
  });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', restoreOptions);
form.addEventListener('submit', saveOptions);
themeToggle.addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
});
siteEnableToggle.addEventListener('change', handleSiteToggle);