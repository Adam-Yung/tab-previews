// content.js

// Timer for detecting a long click on a link.
let longClickTimer;
// Flag to prevent multiple previews from opening simultaneously.
let isPreviewing = false;
// Default settings for the preview window. These can be overridden by user settings from chrome.storage.
let settings = {
  duration: 500,       // Milliseconds for a long press to trigger the preview.
  modifier: 'shiftKey',// Modifier key (e.g., 'shiftKey', 'ctrlKey', 'altKey') to trigger preview on click.
  theme: 'light',      // The color theme for the preview window ('light' or 'dark').
  closeKey: 'Escape',  // Key to close the preview window.
  width: '90vw',       // Default width of the preview window.
  height: '90vh',      // Default height of the preview window.
  top: '50%',          // Default top position.
  left: '50%'          // Default left position.
};

// Variables to store the original overflow styles of the page to restore them later.
let originalBodyOverflow;
let originalDocumentOverflow;

// --- Initialization ---

// Load user settings from chrome.storage and merge them with the default settings.
chrome.storage.local.get(settings).then(loadedSettings => {
  Object.assign(settings, loadedSettings);
});

// Listen for changes in storage and update the local settings object in real-time.
chrome.storage.onChanged.addListener(changes => {
  for (let key in changes) {
    if (settings.hasOwnProperty(key)) {
      settings[key] = changes[key].newValue;
    }
  }
});


/**
 * Recursively checks if an iframe's content has finished loading.
 * Once loaded, it adds a 'loaded' class to the iframe and hides the loading spinner.
 * @param {HTMLIFrameElement} frame The iframe element to check.
 * @param {ShadowRoot} shadowRoot The shadow root containing the loader element.
 */
function checkForIframeReady(frame, shadowRoot) {
  const iframeDoc = frame.contentDocument || frame.contentWindow.document;

  // Check if the iframe document is fully loaded or interactive.
  if (iframeDoc && (iframeDoc.readyState === 'interactive' || iframeDoc.readyState === 'complete')) {
    frame.classList.add('loaded'); // Add class for fade-in animation.
    // Hide the loader with a small delay to allow the fade-in to be smooth.
    setTimeout(() => {
      const loader = shadowRoot.getElementById('loader-container');
      if (loader) {
        loader.style.display = 'none';
      }
    }, 400);
  } else {
    // If not ready, check again on the next animation frame.
    requestAnimationFrame(() => { checkForIframeReady(frame, shadowRoot) });
  }
}

/**
 * Creates and displays the link preview modal.
 * This includes the overlay, shadow DOM container, iframe, and all UI controls.
 * @param {string} url The URL to be loaded in the preview iframe.
 */
function createPreview(url) {
  // Prevent multiple previews.
  if (isPreviewing) return;
  isPreviewing = true;
  clearTimeout(longClickTimer); // Cancel any pending long-click timer.

  // console.log(`[CONTENT] Starting preview for: ${url}`);

  // Store original page overflow styles and then disable scrolling on the main page.
  originalBodyOverflow = document.body.style.overflow;
  originalDocumentOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Create a full-page overlay to dim the background.
  const pageOverlay = document.createElement('div');
  pageOverlay.id = 'link-preview-page-overlay';
  Object.assign(pageOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: '2147483646', // High z-index to be on top of most elements.
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });
  document.body.appendChild(pageOverlay);

  // Inject a style tag to pause all animations and transitions on the host page.
  // This improves performance and prevents distracting movements in the background.
  const pauseStyle = document.createElement('style');
  pauseStyle.id = 'link-preview-animation-pauzer';
  pauseStyle.innerHTML = `
    /* Hide GIFs to prevent them from constantly redrawing */
    img[src$=".gif"] {
      visibility: hidden !important;
    }
    /* Pause all CSS animations and transitions */
    * {
      animation-play-state: paused !important;
      transition: none !important;
      transition-property: none !important;
      transform: none !important;
      scroll-behavior: auto !important;
    }`;
  document.head.appendChild(pauseStyle);
  document.body.style.pointerEvents = 'none'; // Disable pointer events on the main page.

  // Create the host element for the shadow DOM.
  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';
  previewHost.style.pointerEvents = 'auto'; // Re-enable pointer events for the preview itself.
  document.body.appendChild(previewHost);

  // Animate the overlay's opacity for a smooth fade-in effect.
  requestAnimationFrame(() => {
    pageOverlay.style.opacity = '1';
  });

  // Attach a shadow root to encapsulate the preview's styles and DOM.
  const shadowRoot = previewHost.attachShadow({ mode: 'open' });

  // Link the external stylesheet for the preview UI inside the shadow DOM.
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('preview_style.css');
  shadowRoot.appendChild(styleLink);

  // Create a click interceptor inside the shadow DOM to close the preview when clicking outside the container.
  const clickInterceptor = document.createElement('div');
  clickInterceptor.id = 'link-preview-click-interceptor';
  shadowRoot.appendChild(clickInterceptor);

  // Create the main container for the preview window.
  const container = document.createElement('div');
  container.id = 'link-preview-container';
  container.classList.add(settings.theme);

  // Apply size and position from settings.
  container.style.width = settings.width;
  container.style.height = settings.height;
  container.style.top = settings.top;
  container.style.left = settings.left;

  // If using percentage-based positioning, add a class for CSS transform-based centering.
  if (settings.top.includes('%') || settings.left.includes('%')) {
    container.classList.add('is-centered');
  }

  shadowRoot.appendChild(container);

  // Create the address bar with URL display and control buttons.
  const addressBar = document.createElement('div');
  addressBar.id = 'link-preview-address-bar';
  addressBar.innerHTML = `
    <span class="link-preview-url">${url}</span>
    <div class="link-preview-controls">
      <button id="link-preview-restore" title="Restore default size and position">&#x26F6;</button>
      <button id="link-preview-enlarge" title="Open in new tab">↗</button>
      <button id="link-preview-close" title="Close preview">×</button>
    </div>
  `;
  container.appendChild(addressBar);

  // Create the loading spinner.
  const loader = document.createElement('div');
  loader.id = 'loader-container';
  loader.innerHTML = `<div class="loader"></div>`;
  container.appendChild(loader);

  // Create the iframe where the link content will be loaded.
  const iframe = document.createElement('iframe');
  iframe.id = 'link-preview-iframe';
  container.appendChild(iframe);

  // Enable dragging of the preview window via the address bar.
  addressBar.addEventListener('mousedown', (e) => initDrag(e, container, iframe));

  // Create and attach resize handles for all directions.
  const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  resizeHandles.forEach(dir => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${dir}`;
    container.appendChild(handle);
    handle.addEventListener('mousedown', (e) => initResize(e, container, iframe, dir));
  });

  // Send a message to the background script to prepare for the preview (e.g., modify headers).
  chrome.runtime.sendMessage({ action: 'prepareToPreview', url: url })
    .then(response => {
      if (response && response.ready) {
        // Once the background script is ready, set the iframe source.
        iframe.src = url;
        checkForIframeReady(iframe, shadowRoot);
      } else {
        console.error('[CONTENT] Background script not ready.');
        closePreview();
      }
    });

  // --- UI Event Listeners ---
  shadowRoot.getElementById('link-preview-close').addEventListener('click', closePreview);
  shadowRoot.getElementById('link-preview-enlarge').addEventListener('click', () => {
    window.open(url, '_blank');
    closePreview();
  });
  // Restore the preview window to its default size and position and save it.
  shadowRoot.getElementById('link-preview-restore').addEventListener('click', () => {
    container.style.width = '90vw';
    container.style.height = '90vh';
    container.style.top = '50%';
    container.style.left = '50%';
    container.classList.add('is-centered');
    // Save the restored state to storage.
    chrome.storage.local.set({
      width: container.style.width,
      height: container.style.height,
      top: container.style.top,
      left: container.style.left
    });
  });

  clickInterceptor.addEventListener('click', closePreview);
  document.addEventListener('keydown', handleEsc);
}

/**
 * Converts percentage-based or centered positioning to absolute pixel values.
 * This is necessary before starting a drag or resize operation to ensure smooth interaction.
 * @param {HTMLElement} element The element to convert (the preview container).
 */
function convertToPixels(element) {
  // If the element is centered using transforms, calculate its absolute pixel position.
  if (element.classList.contains('is-centered')) {
    const rect = element.getBoundingClientRect();
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.classList.remove('is-centered'); // Remove the class that applies the transform.
    element.style.animation = 'none'; // Disable animations that might interfere.
  }
}

/**
 * Initializes the dragging functionality for the preview window.
 * @param {MouseEvent} e The initial mousedown event.
 * @param {HTMLElement} element The element to be dragged (the preview container).
 * @param {HTMLIFrameElement} iframe The iframe inside the container.
 */
function initDrag(e, element, iframe) {
  // Only allow dragging with the primary mouse button and not on control buttons.
  if (e.button !== 0 || e.target.closest('button')) {
    return;
  }
  e.preventDefault();
  convertToPixels(element); // Ensure positioning is in pixels.

  // Calculate the initial offset of the mouse from the element's top-left corner.
  const offsetX = e.clientX - element.offsetLeft;
  const offsetY = e.clientY - element.offsetTop;

  // Disable pointer events on the iframe to prevent it from capturing mouse events during drag.
  iframe.style.pointerEvents = 'none';

  /**
   * Updates the element's position as the mouse moves.
   * @param {MouseEvent} e The mousemove event.
   */
  function doDrag(e) {
    element.style.left = `${e.clientX - offsetX}px`;
    element.style.top = `${e.clientY - offsetY}px`;
  }

  /**
   * Cleans up event listeners and saves the final position when dragging stops.
   */
  function stopDrag() {
    iframe.style.pointerEvents = 'auto'; // Re-enable pointer events on the iframe.
    document.documentElement.removeEventListener('mousemove', doDrag, false);
    document.documentElement.removeEventListener('mouseup', stopDrag, false);

    // Save the new position to user settings.
    chrome.storage.local.set({
      top: element.style.top,
      left: element.style.left
    });
  }

  // Add the listeners to the entire document to handle mouse movement anywhere on the page.
  document.documentElement.addEventListener('mousemove', doDrag, false);
  document.documentElement.addEventListener('mouseup', stopDrag, false);
}

/**
 * Initializes the resizing functionality for the preview window.
 * @param {MouseEvent} e The initial mousedown event.
 * @param {HTMLElement} element The element to be resized (the preview container).
 * @param {HTMLIFrameElement} iframe The iframe inside the container.
 * @param {string} dir The direction of the resize (e.g., 'n', 'se', 'w').
 */
function initResize(e, element, iframe, dir) {
  e.preventDefault();
  convertToPixels(element); // Ensure dimensions and position are in pixels.
  iframe.style.pointerEvents = 'none'; // Disable iframe interaction during resize.

  // Store initial dimensions and mouse position.
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = element.offsetWidth;
  const startHeight = element.offsetHeight;
  const startLeft = element.offsetLeft;
  const startTop = element.offsetTop;

  /**
   * Updates the element's size and position as the mouse moves.
   * @param {MouseEvent} e The mousemove event.
   */
  function doDrag(e) {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    // Calculate new width, height, and position based on the resize direction.
    if (dir.includes('e')) { newWidth = startWidth + e.clientX - startX; }
    if (dir.includes('w')) {
      newWidth = startWidth - (e.clientX - startX);
      newLeft = startLeft + e.clientX - startX;
    }
    if (dir.includes('s')) { newHeight = startHeight + e.clientY - startY; }
    if (dir.includes('n')) {
      newHeight = startHeight - (e.clientY - startY);
      newTop = startTop + e.clientY - startY;
    }

    element.style.width = `${newWidth}px`;
    element.style.height = `${newHeight}px`;
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  }

  /**
   * Cleans up event listeners and saves the final size and position when resizing stops.
   */
  function stopDrag() {
    iframe.style.pointerEvents = 'auto'; // Re-enable iframe interaction.
    document.documentElement.removeEventListener('mousemove', doDrag, false);
    document.documentElement.removeEventListener('mouseup', stopDrag, false);

    // Save the new dimensions and position to user settings.
    chrome.storage.local.set({
      width: element.style.width,
      height: element.style.height,
      top: element.style.top,
      left: element.style.left
    });
  }
  // Add listeners to the document to handle resizing from anywhere on the page.
  document.documentElement.addEventListener('mousemove', doDrag, false);
  document.documentElement.addEventListener('mouseup', stopDrag, false);
}

/**
 * Closes the preview window and cleans up all related elements and event listeners.
 */
function closePreview() {
  if (!isPreviewing) return;

  const previewHost = document.getElementById('link-preview-host');
  const pageOverlay = document.getElementById('link-preview-page-overlay');
  const pauseStyle = document.getElementById('link-preview-animation-pauzer');

  // Trigger fade-out animations.
  if (previewHost) {
    const container = previewHost.shadowRoot.getElementById('link-preview-container');
    if (container) {
      container.style.animation = 'fadeOut 0.3s forwards ease-out';
    }
  }
  if (pageOverlay) { pageOverlay.style.opacity = '0'; }

  // After the animations, remove elements and restore the page state.
  setTimeout(() => {
    if (previewHost) previewHost.remove();
    if (pageOverlay) pageOverlay.remove();
    if (pauseStyle) pauseStyle.remove();

    // Restore page functionality.
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = originalBodyOverflow;
    document.documentElement.style.overflow = originalDocumentOverflow;

    // Clean up global listeners and state.
    document.removeEventListener('keydown', handleEsc);
    chrome.runtime.sendMessage({ action: 'clearPreview' }); // Tell background to clean up.
    isPreviewing = false;
    // console.log('[CONTENT] Preview closed and cleaned up.');
  }, 200); // Delay should be slightly less than animation duration.
}

/**
 * Handles the keydown event to close the preview on 'Escape'.
 * @param {KeyboardEvent} e The keydown event.
 */
function handleEsc(e) {
  if (e.key === settings.closeKey) {
    closePreview();
  }
}


// --- Global Event Listeners for Triggering Previews ---

// Listen for 'mousedown' to initiate either a long-press or a modifier-key preview.
// Using the capture phase (true) to catch the event early.
document.addEventListener('mousedown', e => {
  // Don't do anything if a preview is already active.
  if (isPreviewing) return;
  const link = e.target.closest('a');
  // Check if the target is a valid link to preview.
  if (link && link.href && !link.href.startsWith('javascript:') && link.target !== '_blank') {
    // If the modifier key is pressed, create the preview immediately.
    if (e[settings.modifier]) {
      e.preventDefault();
      e.stopPropagation();
      createPreview(link.href);
      return;
    }
    // Otherwise, start a timer for a long press.
    longClickTimer = setTimeout(() => {
      createPreview(link.href);
    }, settings.duration);
  }
}, true);

// Listen for 'mouseup' to cancel the long-press timer if the mouse is released early.
document.addEventListener('mouseup', () => {
  clearTimeout(longClickTimer);
}, true);

// Listen for 'click' with the modifier key to prevent the default navigation action.
document.addEventListener('click', e => {
  const link = e.target.closest('a');
  if (link && e[settings.modifier]) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);


// --- Preconnect Optimization ---

let hoverTimer = null;
let lastHoveredUrl = null;

// When a user hovers over a link, send a message to the background script to preconnect.
// This can speed up the eventual loading of the page in the preview.
document.addEventListener('mouseover', e => {
  const link = e.target.closest('a');
  if (link && link.href && link.href !== lastHoveredUrl) {
    lastHoveredUrl = link.href;
    clearTimeout(hoverTimer); // Debounce the event.
    // Wait a moment before preconnecting to avoid doing it for every link the mouse passes over.
    hoverTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'preconnect', url: link.href });
    }, 100);
  }
});

// When the mouse leaves a link, clear the preconnect timer.
document.addEventListener('mouseout', e => {
  const link = e.target.closest('a');
  if (link) {
    clearTimeout(hoverTimer);
    lastHoveredUrl = null;
  }
});