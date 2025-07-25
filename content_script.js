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

// Listen for clicks on the entire document. This is more efficient
// than adding a listener to every single link on the page.
document.addEventListener('click', handleDocumentClick, true);


// --- Core Functions ---

/**
 * Handles all clicks on the document to determine if a link was clicked.
 * @param {MouseEvent} e - The click event object.
 */
function handleDocumentClick(e) {
  // Find the closest 'a' tag ancestor of the clicked element.
  const link = e.target.closest('a');

  // --- Validation: Decide whether to show the preview ---
  if (!link || !link.href) {
    return; // Not a link or link has no href.
  }

  // Don't intercept clicks with modifier keys (Ctrl, Cmd, Shift)
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    return;
  }

  // Don't intercept if the link is meant to open in a new tab.
  if (link.target === '_blank') {
    return;
  }

  // Don't intercept non-http links (e.g., mailto:, tel:, javascript:)
  if (!link.href.startsWith('http')) {
    return;
  }

  // Don't intercept clicks on links that just navigate to a fragment on the same page.
  if (link.href.startsWith(window.location.href + '#')) {
      return;
  }


  // If all checks pass, prevent the default navigation and show the preview.
  e.preventDefault();
  e.stopPropagation();
  createPreview(link.href);
}

/**
 * Creates and injects the preview modal into the DOM.
 * @param {string} url - The URL to load in the preview iframe.
 */
function createPreview(url) {
  // If a preview is already open, don't open another one.
  if (document.getElementById('lp-preview-container')) {
    return;
  }

  // --- Create DOM Elements ---

  // 1. The semi-transparent backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'lp-backdrop';

  // 2. The main preview container
  const container = document.createElement('div');
  container.id = 'lp-preview-container';
  container.classList.add(`lp-theme-${userSettings.theme}`);

  // 3. The top "address bar"
  const header = document.createElement('div');
  header.id = 'lp-header';

  const urlDisplay = document.createElement('span');
  urlDisplay.id = 'lp-url-display';
  urlDisplay.textContent = url;

  const controls = document.createElement('div');
  controls.id = 'lp-controls';

  // Enlarge button
  const enlargeBtn = document.createElement('button');
  enlargeBtn.title = 'Open in New Tab';
  enlargeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
  enlargeBtn.onclick = () => {
    window.open(url, '_blank');
    closePreview();
  };

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.title = 'Close Preview';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  closeBtn.onclick = closePreview;

  controls.append(enlargeBtn, closeBtn);
  header.append(urlDisplay, controls);

  // 4. The iframe to load the content
  const iframe = document.createElement('iframe');
  iframe.id = 'lp-iframe';
  iframe.src = url;
  // Security sandbox to restrict some actions within the iframe
  iframe.sandbox = "allow-forms allow-scripts allow-same-origin allow-popups";

  // --- Assemble and Append ---
  container.append(header, iframe);
  document.body.append(backdrop, container);
  document.body.style.overflow = 'hidden'; // Prevent parent page from scrolling

  // --- Sizing and Positioning ---
  setPreviewSize(container);

  // --- Add Event Listeners for Closing ---
  backdrop.addEventListener('click', closePreview);
  document.addEventListener('keydown', handleKeyPress);
}

/**
 * Closes the preview modal and cleans up the DOM.
 */
function closePreview() {
  const backdrop = document.getElementById('lp-backdrop');
  const container = document.getElementById('lp-preview-container');

  if (container) {
    container.classList.add('lp-closing'); // Add class to trigger closing animation
    // Wait for animation to finish before removing elements
    setTimeout(() => {
        backdrop?.remove();
        container?.remove();
        document.body.style.overflow = ''; // Restore scrolling
        document.removeEventListener('keydown', handleKeyPress);
    }, 200); // Must match animation duration in CSS
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
    const PADDING = 60; // Space around the preview window
    const parentWidth = window.innerWidth;
    const parentHeight = window.innerHeight;

    // Calculate max dimensions based on 90% of viewport or fixed padding
    const maxWidth = Math.min(parentWidth * 0.9, parentWidth - PADDING);
    const maxHeight = Math.min(parentHeight * 0.9, parentHeight - PADDING);

    // Maintain parent window's aspect ratio
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
