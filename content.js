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
  pauseStyle.innerHTML = `
  img[src$=".gif"] {
      visibility: hidden !important;
  }
  
  * { 
    animation-play-state: paused !important; 
    transition-property: none !important; 
    transform: none !important;
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
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = browser.runtime.getURL('preview_style.css');
  shadowRoot.appendChild(styleLink);

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
