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

  // PERFORMANCE FIX 1: Create a cheap, high-performance overlay
  const pageOverlay = document.createElement('div');
  pageOverlay.id = 'link-preview-page-overlay';
  Object.assign(pageOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: '2147483646',
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });
  document.body.appendChild(pageOverlay);

  // PERFORMANCE FIX 2: Pause all animations/transitions on the parent page
  const pauseStyle = document.createElement('style');
  pauseStyle.id = 'link-preview-animation-pauzer';
  pauseStyle.innerHTML = `* { 
    animation-play-state: paused !important; 
    transition: none !important; 
    scroll-behavior: auto !important;
  }`;
  document.head.appendChild(pauseStyle);
  
  // PERFORMANCE FIX 3: Disable mouse events on the background page
  document.body.style.pointerEvents = 'none';

  // Create the host element for our Shadow DOM
  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';
  previewHost.style.pointerEvents = 'auto'; // Re-enable pointer events for our UI
  document.body.appendChild(previewHost);
  
  // Fade in the overlay
  requestAnimationFrame(() => {
    pageOverlay.style.opacity = '1';
  });
  
  const shadowRoot = previewHost.attachShadow({ mode: 'open' });

  // Create the UI elements
  const style = document.createElement('style');
  style.textContent = getPreviewCSS();
  shadowRoot.appendChild(style);

  const clickInterceptor = document.createElement('div');
  clickInterceptor.id = 'link-preview-click-interceptor';
  shadowRoot.appendChild(clickInterceptor);

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
  
  const loader = document.createElement('div');
  loader.className = 'loader-container';
  loader.innerHTML = `<div class="loader"></div>`;
  container.appendChild(loader);

  const iframe = document.createElement('iframe');
  iframe.id = 'link-preview-iframe';
  container.appendChild(iframe);

  // Ask background script to get ready for the network request
  browser.runtime.sendMessage({ action: 'prepareToPreview', url: url })
    .then(response => {
      if (response && response.ready) {
        iframe.src = url;
        iframe.onload = () => {
          loader.style.display = 'none';
          // SCROLL TRAPPING LOGIC
          try {
            const iframeDoc = iframe.contentDocument.documentElement;
            iframe.contentWindow.addEventListener('wheel', e => {
              const { scrollTop, scrollHeight, clientHeight } = iframeDoc;
              if ((e.deltaY > 0 && Math.abs(scrollHeight - clientHeight - scrollTop) < 1) || (e.deltaY < 0 && scrollTop === 0)) {
                e.preventDefault();
              }
            }, { passive: false });
          } catch(err) {
            console.warn("[Link Previewer] Could not attach scroll listener to iframe.");
          }
        };
      } else {
          console.error('[CONTENT] Background script not ready.');
          closePreview();
      }
    });

  // Add Event Listeners for controls
  shadowRoot.getElementById('link-preview-close').addEventListener('click', closePreview);
  shadowRoot.getElementById('link-preview-enlarge').addEventListener('click', () => {
    window.open(url, '_blank');
    closePreview();
  });
  clickInterceptor.addEventListener('click', closePreview);
  document.addEventListener('keydown', handleEsc);
}

/**
 * Closes and cleans up the preview window.
 */
function closePreview() {
  if (!isPreviewing) return;
  
  const previewHost = document.getElementById('link-preview-host');
  const pageOverlay = document.getElementById('link-preview-page-overlay');
  const pauseStyle = document.getElementById('link-preview-animation-pauzer');
  
  if (previewHost) {
    const container = previewHost.shadowRoot.getElementById('link-preview-container');
    if (container) {
        container.style.animation = 'fadeOut 0.2s forwards ease-out';
    }
  }

  if (pageOverlay) {
    pageOverlay.style.opacity = '0';
  }
  
  setTimeout(() => {
    if (previewHost) previewHost.remove();
    if (pageOverlay) pageOverlay.remove();
    if (pauseStyle) pauseStyle.remove();
    
    document.body.style.pointerEvents = 'auto'; // Restore mouse events
    document.removeEventListener('keydown', handleEsc);
    browser.runtime.sendMessage({ action: 'clearPreview' });
    
    isPreviewing = false;
    console.log('[CONTENT] Preview closed and cleaned up.');
  }, 200); // Wait for animations to finish
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
 * Returns the CSS for the preview UI as a string. (WITH COSMETIC CHANGES)
 */
function getPreviewCSS() {
  return `
    :host {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2147483647; pointer-events: none;
    }
    #link-preview-click-interceptor {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: auto;
    }
    #link-preview-container {
      position: absolute; top: 50%; left: 50%; width: 90vw; height: 90vh;
      border-radius: 15px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      display: flex; flex-direction: column; overflow: hidden;
      pointer-events: auto;
      backdrop-filter: blur(12px) saturate(150%);
      -webkit-backdrop-filter: blur(12px) saturate(150%);
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
      background: rgba(255, 255, 255, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    #link-preview-container.dark {
      background: rgba(30, 30, 30, 0.5);
      color: #f1f1f1;
      border: 2px solid rgba(255, 255, 255, 0.1);
    }
    #link-preview-address-bar {
      display: flex; align-items: center; padding: 6px 15px; /* Slimmer padding */
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px; flex-shrink: 0;
    }
    #link-preview-container.light #link-preview-address-bar {
      background: rgba(255, 255, 255, 0.4); /* More transparent */
      color: #111;
    }
    #link-preview-container.dark #link-preview-address-bar {
      background: rgba(0, 0, 0, 0.25); /* More transparent */
    }
    .link-preview-url {
      flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 15px;
    }
    .link-preview-controls button {
      background: transparent; border: none; font-size: 20px;
      cursor: pointer; padding: 0 8px; color: inherit; opacity: 0.7; 
      transition: opacity 0.2s, transform 0.2s;
    }
    .link-preview-controls button:hover { opacity: 1; transform: scale(1.1); }
    .loader-container {
      position: absolute; top: 40px; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.5);
    }
    .loader {
        border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%;
        width: 50px; height: 50px; animation: spin 1.5s linear infinite;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    #link-preview-iframe {
      flex-grow: 1; border: none; background: #fff;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    #link-preview-container.dark #link-preview-iframe {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;
}