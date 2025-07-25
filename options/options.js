/**
 * options.js
 * Handles saving and loading user preferences from the options page.
 */

function saveOptions(e) {
  e.preventDefault();
  const theme = document.querySelector('input[name="theme"]:checked').value;
  const closeKey = document.getElementById('closeKey').value;

  browser.storage.sync.set({
    theme: theme,
    closeKey: closeKey || 'Escape' // Default to Escape if empty
  }).then(() => {
    // Update status to let user know options were saved.
    const status = document.getElementById('status-message');
    status.textContent = 'Options saved.';
    status.style.opacity = 1;
    setTimeout(() => {
      status.style.opacity = 0;
    }, 2000);
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    // Set theme
    const themeValue = result.theme || 'dark';
    document.querySelector(`input[name="theme"][value="${themeValue}"]`).checked = true;
    
    // Set close key
    document.getElementById('closeKey').value = result.closeKey || 'Escape';
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.sync.get(['theme', 'closeKey']);
  getting.then(setCurrentChoice, onError);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('settings-form').addEventListener('submit', saveOptions);
