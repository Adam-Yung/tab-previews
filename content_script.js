/**
 * @file content_script.js
 * @description This script is injected into every webpage. It intercepts link clicks
 * and creates the preview modal instead of allowing the browser to navigate.
 */

// --- Globals & Configuration ---

let userSettings = {
  theme: 'dark',
  closeKey: 'Escape'
};

// --- Main Execution ---

// Load user settings from storage as soon as the script loads.
browser.storage.sync.get(['theme', 'closeKey']).then(settings => {
  if (settings.theme) userSettings.theme = settings.theme;
  if (settings.closeKey) userSettings.closeKey = settings.closeKey;
});

// Listen for clicks on the entire document.
document.addEventListener('click', handleDocumentClick, true);


// --- Core Functions ---

/**
 * Handles all clicks on the document to determine if a link was clicked.
 * @param {MouseEvent} e - The click event object.
 */
function handleDocumentClick(e) {
  const link = e.target.closest('a');

  if (!link || !link.href || (e.ctrlKey || e.metaKey || e.shiftKey) || link.target === '_blank' || !link.href.startsWith('http') || link.href.startsWith(window.location.href + '#')) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  createPreview(link.href);
}

/**
 * Creates and injects the preview modal into the DOM.
 * @param {string} url - The URL to load in the preview iframe.
 */
function createPreview(url) {
  if (document.getElementById('lp-preview-container')) {
    return;
  }

  // --- Create DOM Elements ---
  const backdrop = document.createElement('div');
  backdrop.id = 'lp-backdrop';

  const container = document.createElement('div');
  container.id = 'lp-preview-container';
  container.classList.add(`lp-theme-${userSettings.theme}`);

  const header = document.createElement('div');
  header.id = 'lp-header';

  const urlDisplay = document.createElement('span');
  urlDisplay.id = 'lp-url-display';
  urlDisplay.textContent = url;

  const controls = document.createElement('div');
  controls.id = 'lp-controls';

  const enlargeBtn = document.createElement('button');
  enlargeBtn.title = 'Open in New Tab';
  enlargeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
  enlargeBtn.onclick = () => {
    window.open(url, '_blank');
    closePreview();
  };

  const closeBtn = document.createElement('button');
  closeBtn.title = 'Close Preview';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  closeBtn.onclick = closePreview;

  controls.append(enlargeBtn, closeBtn);
  header.append(urlDisplay, controls);

  // Create a container for the iframe and a loading indicator
  const contentArea = document.createElement('div');
  contentArea.id = 'lp-content-area';

  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'lp-loading';
  loadingIndicator.textContent = 'Loading Preview...';
  
  const iframe = document.createElement('iframe');
  iframe.id = 'lp-iframe';
  iframe.sandbox = "allow-forms allow-scripts allow-same-origin allow-popups";

  // --- Assemble and Append ---
  contentArea.append(loadingIndicator, iframe);
  container.append(header, contentArea);
  document.body.append(backdrop, container);
  document.body.style.overflow = 'hidden';

  setPreviewSize(container);
  backdrop.addEventListener('click', closePreview);
  document.addEventListener('keydown', handleKeyPress);

  // --- Fetch Content via Background Script ---
  browser.runtime.sendMessage({ type: 'fetchUrl', url: url })
    .then(response => {
      loadingIndicator.style.display = 'none'; // Hide loading indicator
      if (response && response.success) {
        // Use srcdoc to inject the fetched HTML. This is key to bypassing X-Frame-Options.
        iframe.srcdoc = response.htmlContent;
      } else {
        // Display an error message if the fetch failed
        const errorDisplay = document.createElement('div');
        errorDisplay.id = 'lp-error';
        errorDisplay.textContent = response.error || 'Failed to load preview.';
        contentArea.append(errorDisplay);
        iframe.remove();
      }
    }).catch(err => {
        loadingIndicator.textContent = 'Error loading preview.';
        console.error("Error receiving message from background script:", err);
    });
}

/**
 * Closes the preview modal and cleans up the DOM.
 */
function closePreview() {
  const backdrop = document.getElementById('lp-backdrop');
  const container = document.getElementById('lp-preview-container');

  if (container) {
    container.classList.add('lp-closing');
    setTimeout(() => {
        backdrop?.remove();
        container?.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyPress);
    }, 200);
  }
}

/**
 * Handles key presses, specifically to close the modal.
 * @param {KeyboardEvent} e - The keydown event object.
 */
function handleKeyPress(e) {
  if (e.key === userSettings.closeKey) {
    closePreview();
  }
}

/**
 * Calculates and sets the size and position of the preview window.
 * @param {HTMLElement} container - The preview container element.
 */
function setPreviewSize(container) {
    const PADDING = 60;
    const parentWidth = window.innerWidth;
    const parentHeight = window.innerHeight;

    const maxWidth = Math.min(parentWidth * 0.9, parentWidth - PADDING);
    const maxHeight = Math.min(parentHeight * 0.9, parentHeight - PADDING);

    const parentAspectRatio = parentWidth / parentHeight;
    
    let previewWidth = maxWidth;
    let previewHeight = previewWidth / parentAspectRatio;

    if (previewHeight > maxHeight) {
        previewHeight = maxHeight;
        previewWidth = previewHeight * parentAspectRatio;
    }

    container.style.width = `${previewWidth}px`;
    container.style.height = `${previewHeight}px`;
    container.style.top = `${(parentHeight - previewHeight) / 2}px`;
    container.style.left = `${(parentWidth - previewWidth) / 2}px`;
}
