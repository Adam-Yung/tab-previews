// options.js

// --- DOM Elements ---
const form = document.getElementById('settings-form');
const themeToggle = document.getElementById('theme-toggle');
const statusDiv = document.getElementById('save-status');
const saveButton = document.getElementById('save-button');

// --- Default Settings ---
const defaults = {
    duration: 500,
    modifier: 'shiftKey',
    theme: 'light',
    closeKey: 'Escape'
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
 * Saves the current form settings to browser storage.
 * @param {Event} e - The form submission event.
 */
function saveOptions(e) {
  e.preventDefault();
  const settings = {
    duration: document.getElementById('duration').value,
    modifier: document.getElementById('modifier').value,
    theme: themeToggle.checked ? 'dark' : 'light',
    closeKey: document.getElementById('closeKey').value || 'Escape' // Default to Escape if empty
  };

  browser.storage.local.set(settings).then(() => {
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
}

/**
 * Restores saved settings from storage and populates the form.
 */
function restoreOptions() {
  browser.storage.local.get(defaults).then(items => {
    document.getElementById('duration').value = items.duration;
    document.getElementById('modifier').value = items.modifier;
    document.getElementById('closeKey').value = items.closeKey;
    applyTheme(items.theme);
  });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', restoreOptions);
form.addEventListener('submit', saveOptions);
themeToggle.addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
});
