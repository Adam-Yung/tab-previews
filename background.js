// background.js

const DEBUG = true;
function debug(msg) {
  if (DEBUG)
    console.log(msg);
}

let previewingUrl = null;

function requestHeadersListener(details) {
  // We only want to modify requests initiated by our own extension
  if (details.initiator === browser.runtime.id || details.originUrl?.startsWith(browser.runtime.getURL(""))) {
    const targetOrigin = new URL(details.url).origin;

    let originHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'origin');
    if (originHeader) {
      // Spoof the origin to make it look like a same-origin request
      originHeader.value = targetOrigin;
    } else {
      // Add the origin header if it doesn't exist
      details.requestHeaders.push({ name: 'Origin', value: targetOrigin });
    }
    
    // Also spoof the Referer for good measure
     details.requestHeaders.push({ name: 'Referer', value: details.url });

    debug(`[BACKGROUND] Spoofed the header request to use appear as same origin: ${details.url}`);
    return { requestHeaders: details.requestHeaders };
  }
  return { requestHeaders: details.requestHeaders };
}


// --- Listener to modify response headers ---
function responseHeadersListener(details) {
  const isPreviewFrame = details.type === 'sub_frame' && previewingUrl;
  const isPreconnectRequest = details.type === 'xhr' || details.type === 'xmlhttprequest';

  if (isPreviewFrame || isPreconnectRequest) {
    const newHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase();
      debug(`[BACKGROUND] Cleaned the response header for iframe display: ${previewingUrl}`);
      return !(
        headerName === 'content-security-policy' ||
        headerName === 'x-frame-options' ||
        headerName === 'x-content-type-options' ||
        headerName === 'cross-origin-embedder-policy' ||
        headerName === 'cross-origin-opener-policy' ||
        headerName === 'cross-origin-resource-policy' ||
        headerName === 'referrer-policy'
      );
    });
    return { responseHeaders: newHeaders };
  }
  return { responseHeaders: details.responseHeaders };
}

// --- Register all listeners ---
// NEW: Register the request header listener
browser.webRequest.onBeforeSendHeaders.addListener(
  requestHeadersListener,
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["blocking", "requestHeaders"]
);

// Register the response header listener
browser.webRequest.onHeadersReceived.addListener(
  responseHeadersListener,
  { urls: ["<all_urls>"], types: ["sub_frame", "xhr", "xmlhttprequest"] },
  ["blocking", "responseHeaders"]
);


// --- Message handling from content scripts ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'prepareToPreview':
      debug(`[BACKGROUND] Preparing for preview: ${request.url}`);
      previewingUrl = request.url;
      sendResponse({ ready: true });
      return true;

    case 'clearPreview':
      previewingUrl = null;
      break;

    case 'preconnect':
      const controller = new AbortController();
      const signal = controller.signal;
      debug(`[BACKGROUND] Preconnecting to: ${request.url}`);
      // Use GET as it's more widely supported than HEAD
      fetch(request.url, { method: 'GET', mode: 'cors', signal }).catch(() => {
          // Errors are expected as we abort the request. This is fine.
      });

      // Abort the request immediately. We don't need the body,
      // just the act of making the request is enough to warm up the connection.
      controller.abort();
      break;
  }
});