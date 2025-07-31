// content.js

let longClickTimer;
let isPreviewing = false;
let settings = {
  duration: 500,
  modifier: 'shiftKey',
  theme: 'light',
  closeKey: 'Escape',
  width: '90vw',
  height: '90vh',
  top: '50%',
  left: '50%'
};

let originalBodyOverflow;
let originalDocumentOverflow;

// Initialization
chrome.storage.local.get(settings).then(loadedSettings => {
  Object.assign(settings, loadedSettings);
});

chrome.storage.onChanged.addListener(changes => {
  for (let key in changes) {
    if (settings.hasOwnProperty(key)) {
      settings[key] = changes[key].newValue;
    }
  }
});

function checkForIframeReady(frame, shadowRoot) {
  const iframeDoc = frame.contentDocument || frame.contentWindow.document;

  if (iframeDoc && (iframeDoc.readyState === 'interactive' || iframeDoc.readyState === 'complete')) {
    // console.log('[CONTENT] Iframe is interactive, scheduling hide loader.');
    frame.classList.add('loaded');
    setTimeout(() => {
      const loader = shadowRoot.getElementById('loader-container');
      if (loader) {
        loader.style.display = 'none';
      }
    }, 400);
  } else {
    requestAnimationFrame(() => { checkForIframeReady(frame, shadowRoot) });
  }
}

function createPreview(url) {
  if (isPreviewing) return;
  isPreviewing = true;
  clearTimeout(longClickTimer);

  console.log(`[CONTENT] Starting preview for: ${url}`);

  originalBodyOverflow = document.body.style.overflow;
  originalDocumentOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

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

  const pauseStyle = document.createElement('style');
  pauseStyle.id = 'link-preview-animation-pauzer';
  pauseStyle.innerHTML = `
  img[src$=".gif"] { visibility: hidden !important; }
  * {
    animation-play-state: paused !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }`;
  document.head.appendChild(pauseStyle);
  document.body.style.pointerEvents = 'none';

  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';
  previewHost.style.pointerEvents = 'auto';
  document.body.appendChild(previewHost);

  requestAnimationFrame(() => {
    pageOverlay.style.opacity = '1';
  });

  const shadowRoot = previewHost.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('preview_style.css');
  shadowRoot.appendChild(styleLink);

  const clickInterceptor = document.createElement('div');
  clickInterceptor.id = 'link-preview-click-interceptor';
  shadowRoot.appendChild(clickInterceptor);

  const container = document.createElement('div');
  container.id = 'link-preview-container';
  container.classList.add(settings.theme);

  container.style.width = settings.width;
  container.style.height = settings.height;
  container.style.top = settings.top;
  container.style.left = settings.left;

  if (settings.top.includes('%') || settings.left.includes('%')) {
    container.classList.add('is-centered');
  }

  shadowRoot.appendChild(container);

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

  const loader = document.createElement('div');
  loader.id = 'loader-container';
  loader.innerHTML = `<div class="loader"></div>`;
  container.appendChild(loader);

  const iframe = document.createElement('iframe');
  iframe.id = 'link-preview-iframe';
  container.appendChild(iframe);

  addressBar.addEventListener('mousedown', (e) => initDrag(e, container, iframe));

  const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  resizeHandles.forEach(dir => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${dir}`;
    container.appendChild(handle);
    handle.addEventListener('mousedown', (e) => initResize(e, container, iframe, dir));
  });

  chrome.runtime.sendMessage({ action: 'prepareToPreview', url: url })
    .then(response => {
      if (response && response.ready) {
        iframe.src = url;
        checkForIframeReady(iframe, shadowRoot);
      } else {
        console.error('[CONTENT] Background script not ready.');
        closePreview();
      }
    });

  shadowRoot.getElementById('link-preview-close').addEventListener('click', closePreview);
  shadowRoot.getElementById('link-preview-enlarge').addEventListener('click', () => {
    window.open(url, '_blank');
    closePreview();
  });
  shadowRoot.getElementById('link-preview-restore').addEventListener('click', () => {
    container.style.width = '90vw';
    container.style.height = '90vh';
    container.style.top = '50%';
    container.style.left = '50%';
    container.classList.add('is-centered');
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

function convertToPixels(element) {
  if (element.classList.contains('is-centered')) {
    const rect = element.getBoundingClientRect();
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.classList.remove('is-centered');
    element.style.animation = 'none';
  }
}

function initDrag(e, element, iframe) {
  if (e.button !== 0 || e.target.closest('button')) {
    return;
  }
  e.preventDefault();
  convertToPixels(element);

  const offsetX = e.clientX - element.offsetLeft;
  const offsetY = e.clientY - element.offsetTop;

  iframe.style.pointerEvents = 'none';

  function doDrag(e) {
    element.style.left = `${e.clientX - offsetX}px`;
    element.style.top = `${e.clientY - offsetY}px`;
  }

  function stopDrag() {
    iframe.style.pointerEvents = 'auto';
    document.documentElement.removeEventListener('mousemove', doDrag, false);
    document.documentElement.removeEventListener('mouseup', stopDrag, false);

    chrome.storage.local.set({
      top: element.style.top,
      left: element.style.left
    });
  }

  document.documentElement.addEventListener('mousemove', doDrag, false);
  document.documentElement.addEventListener('mouseup', stopDrag, false);
}

function initResize(e, element, iframe, dir) {
  e.preventDefault();
  convertToPixels(element);
  iframe.style.pointerEvents = 'none';

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = element.offsetWidth;
  const startHeight = element.offsetHeight;
  const startLeft = element.offsetLeft;
  const startTop = element.offsetTop;

  function doDrag(e) {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

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

  function stopDrag() {
    iframe.style.pointerEvents = 'auto';
    document.documentElement.removeEventListener('mousemove', doDrag, false);
    document.documentElement.removeEventListener('mouseup', stopDrag, false);

    chrome.storage.local.set({
      width: element.style.width,
      height: element.style.height,
      top: element.style.top,
      left: element.style.left
    });
  }
  document.documentElement.addEventListener('mousemove', doDrag, false);
  document.documentElement.addEventListener('mouseup', stopDrag, false);
}

function closePreview() {
  if (!isPreviewing) return;

  const previewHost = document.getElementById('link-preview-host');
  const pageOverlay = document.getElementById('link-preview-page-overlay');
  const pauseStyle = document.getElementById('link-preview-animation-pauzer');

  if (previewHost) {
    const container = previewHost.shadowRoot.getElementById('link-preview-container');
    if (container) {
      container.style.animation = 'fadeOut 0.3s forwards ease-out';
    }
  }
  if (pageOverlay) { pageOverlay.style.opacity = '0'; }

  setTimeout(() => {
    if (previewHost) previewHost.remove();
    if (pageOverlay) pageOverlay.remove();
    if (pauseStyle) pauseStyle.remove();

    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = originalBodyOverflow;
    document.documentElement.style.overflow = originalDocumentOverflow;

    document.removeEventListener('keydown', handleEsc);
    chrome.runtime.sendMessage({ action: 'clearPreview' });
    isPreviewing = false;
    console.log('[CONTENT] Preview closed and cleaned up.');
  }, 200);
}

function handleEsc(e) {
  if (e.key === settings.closeKey) {
    closePreview();
  }
}

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

let hoverTimer = null;
let lastHoveredUrl = null;

document.addEventListener('mouseover', e => {
  const link = e.target.closest('a');
  if (link && link.href && link.href !== lastHoveredUrl) {
    lastHoveredUrl = link.href;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'preconnect', url: link.href });
    }, 100);
  }
});

document.addEventListener('mouseout', e => {
  const link = e.target.closest('a');
  if (link) {
    clearTimeout(hoverTimer);
    lastHoveredUrl = null;
  }
});