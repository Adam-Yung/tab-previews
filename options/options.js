// options.js

const form = document.getElementById('settings-form');
const themeToggle = document.getElementById('theme-toggle');
const statusDiv = document.getElementById('save-status');
const saveButton = document.getElementById('save-button');

const defaults = {
    duration: 500,
    modifier: 'shiftKey',
    theme: 'light',
    closeKey: 'Escape',
    width: '90vw',
    height: '90vh'
};

function applyTheme(theme) {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    themeToggle.checked = theme === 'dark';
}

function saveOptions(e) {
  e.preventDefault();
  const settings = {
    duration: document.getElementById('duration').value,
    modifier: document.getElementById('modifier').value,
    theme: themeToggle.checked ? 'dark' : 'light',
    closeKey: document.getElementById('closeKey').value || 'Escape',
    width: document.getElementById('width').value,
    height: document.getElementById('height').value
  };

  chrome.storage.local.set(settings).then(() => {
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

function restoreOptions() {
  chrome.storage.local.get(defaults).then(items => {
    document.getElementById('duration').value = items.duration;
    document.getElementById('modifier').value = items.modifier;
    document.getElementById('closeKey').value = items.closeKey;
    document.getElementById('width').value = items.width;
    document.getElementById('height').value = items.height;
    applyTheme(items.theme);
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
form.addEventListener('submit', saveOptions);
themeToggle.addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
});