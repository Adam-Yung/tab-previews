// content.js

let longClickTimer;
let isPreviewing = false; // Prevent multiple previews
let settings = {
  duration: 500,
  modifier: 'shiftKey',
  theme: 'light',
  closeKey: 'Escape'
};

// --- Initialization ---
browser.storage.local.get(settings).then(loadedSettings => {
  Object.assign(settings, loadedSettings);
});
browser.storage.onChanged.addListener(changes => {
  for (let key in changes) {
    if (settings.hasOwnProperty(key)) {
      settings[key] = changes[key].newValue;
    }
  }
});

/**
 * Creates the preview UI and loads the content safely.
 * @param {string} url - The URL to preview.
 */
function createPreview(url) {
  if (isPreviewing) return;
  isPreviewing = true;
  clearTimeout(longClickTimer);

  console.log(`[CONTENT] Starting preview for: ${url}`);

  // 1. Create the host element for our Shadow DOM
  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';
  document.body.appendChild(previewHost);

  // 2. Create the Shadow Root
  const shadowRoot = previewHost.attachShadow({ mode: 'open' });

  // 3. Create the UI elements (but don't load the iframe yet)
  const style = document.createElement('style');
  style.textContent = getPreviewCSS(); // CSS is now injected first
  shadowRoot.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'link-preview-overlay';
  shadowRoot.appendChild(overlay);

  const container = document.createElement('div');
  container.id = 'link-preview-container';
  container.classList.add(settings.theme);
  shadowRoot.appendChild(container);

  const addressBar = document.createElement('div');
  addressBar.id = 'link-preview-address-bar';
  addressBar.innerHTML = `
    <span class="link-preview-url">${url}</span>
    <div class="link-preview-controls">
      <button id="link-preview-enlarge" title="Open in new tab">↗</button>
      <button id="link-preview-close" title="Close preview">×</button>
    </div>
  `;
  container.appendChild(addressBar);
  
  // Add a loading indicator
  const loader = document.createElement('div');
  loader.className = 'loader-container';
  loader.innerHTML = `<div class="loader"></div>`;
  container.appendChild(loader);

  const iframe = document.createElement('iframe');
  iframe.id = 'link-preview-iframe';
  // IMPORTANT: DO NOT set iframe.src here yet
  container.appendChild(iframe);

  // Dim the main page
  document.body.classList.add('link-preview-page-active');

  // 4. THE FIX: Ask the background script to get ready
  console.log('[CONTENT] Sending "prepareToPreview" message to background.');
  browser.runtime.sendMessage({ action: 'prepareToPreview', url: url })
    .then(response => {
      if (response && response.ready) {
        console.log('[CONTENT] Background is ready. Loading iframe src.');
        // 5. Once background confirms, load the iframe content
        iframe.src = url;
        iframe.onload = () => {
          // Hide loader when content is displayed
          loader.style.display = 'none';
          console.log('[CONTENT] Iframe content loaded.');
        };
      } else {
          console.error('[CONTENT] Did not receive ready signal from background script.');
          closePreview();
      }
    });

  // --- Add Event Listeners for controls ---
  shadowRoot.getElementById('link-preview-close').addEventListener('click', closePreview);
  shadowRoot.getElementById('link-preview-enlarge').addEventListener('click', () => {
    window.open(url, '_blank');
    closePreview();
  });
  overlay.addEventListener('click', closePreview);
  document.addEventListener('keydown', handleEsc);
}

/**
 * Closes and cleans up the preview window.
 */
function closePreview() {
  if (!isPreviewing) return;
  const previewHost = document.getElementById('link-preview-host');
  if (previewHost) {
    const container = previewHost.shadowRoot.getElementById('link-preview-container');
    if (container) {
        container.style.animation = 'fadeOut 0.2s forwards ease-out';
    }

    setTimeout(() => {
        previewHost.remove();
        document.body.classList.remove('link-preview-page-active');
        document.removeEventListener('keydown', handleEsc);
        browser.runtime.sendMessage({ action: 'clearPreview' });
        isPreviewing = false;
        console.log('[CONTENT] Preview closed and cleaned up.');
    }, 200);
  }
}

function handleEsc(e) {
  if (e.key === settings.closeKey) {
    closePreview();
  }
}

// --- Event Listeners for triggering preview ---
document.addEventListener('mousedown', e => {
  if (isPreviewing) return;
  const link = e.target.closest('a');
  // Added a check to ignore links that open in a new tab by default
  if (link && link.href && !link.href.startsWith('javascript:') && link.target !== '_blank') {
    if (e[settings.modifier]) {
      e.preventDefault();
      e.stopPropagation();
      createPreview(link.href);
      return;
    }
    longClickTimer = setTimeout(() => {
      createPreview(link.href);
    }, settings.duration);
  }
}, true);

document.addEventListener('mouseup', () => {
  clearTimeout(longClickTimer);
}, true);

document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && e[settings.modifier]) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

/**
 * Returns the CSS for the preview UI as a string.
 * This is injected into the Shadow DOM to ensure styles are isolated.
 */
function getPreviewCSS() {
  return `
    :host {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2147483647; pointer-events: none;
    }
    #link-preview-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: transparent; pointer-events: auto;
    }
    #link-preview-container {
      position: absolute; top: 50%; left: 50%; width: 90vw; height: 90vh;
      border-radius: 15px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      display: flex; flex-direction: column; overflow: hidden;
      pointer-events: auto;
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      animation: fadeIn 0.3s forwards cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes fadeIn {
      from { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
      to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @keyframes fadeOut {
      from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      to { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
    }
    #link-preview-container.light {
      background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.25);
    }
    #link-preview-container.dark {
      background: rgba(30, 30, 30, 0.65); color: #f1f1f1; border: 1px solid rgba(255, 255, 255, 0.1);
    }
    #link-preview-address-bar {
      display: flex; align-items: center; padding: 10px 15px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px; flex-shrink: 0;
    }
    #link-preview-container.light #link-preview-address-bar {
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.6));
      border-bottom: 1px solid rgba(0, 0, 0, 0.08); color: #333;
    }
    #link-preview-container.dark #link-preview-address-bar {
      background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .link-preview-url {
      flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 15px;
    }
    .link-preview-controls button {
      background: transparent; border: none; font-size: 22px; cursor: pointer;
      padding: 0 8px; color: inherit; opacity: 0.7; transition: opacity 0.2s, transform 0.2s;
    }
    .link-preview-controls button:hover { opacity: 1; transform: scale(1.1); }
    .loader-container {
        flex-grow: 1; display: flex; align-items: center; justify-content: center; background: #fff;
    }
    .loader {
        border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%;
        width: 50px; height: 50px; animation: spin 1.5s linear infinite;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    #link-preview-iframe {
      flex-grow: 1; border: none; background: transparent;
    }
  `;
}