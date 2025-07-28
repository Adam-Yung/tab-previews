// background.js

let previewingUrl = null;

/**
 * The core logic: Intercepts network requests intended for the preview iframe.
 * It strips security headers that would prevent the page from being displayed.
 */
function headersListener(details) {
  // We only modify headers for the specific URL we are currently trying to preview.
  if (details.type === 'sub_frame' && details.url === previewingUrl) {
    console.log(`[BACKGROUND] Intercepted headers for target URL: ${details.url}`);
    
    const newHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase();
      // Remove security headers that prevent framing.
      const isForbiddenHeader = 
        headerName === 'content-security-policy' ||
        headerName === 'x-frame-options' ||
        headerName === 'x-content-type-options';
      
      if (isForbiddenHeader) {
        console.log(`[BACKGROUND] Removing header: ${headerName}`);
      }
      return !isForbiddenHeader;
    });

    // After we've successfully intercepted and modified the headers,
    // we can clear the target URL to prevent accidentally modifying other requests.
    previewingUrl = null;
    console.log('[BACKGROUND] Headers modified. Clearing target URL.');

    return { responseHeaders: newHeaders };
  }
  // Return unmodified headers for all other requests.
  return { responseHeaders: details.responseHeaders };
}

// Register the webRequest listener
browser.webRequest.onHeadersReceived.addListener(
  headersListener,
  { urls: ["<all_urls>"], types: ["sub_frame"] },
  ["blocking", "responseHeaders"]
);

/**
 * Listens for messages from other parts of the extension.
 */
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    // This is the new, race-condition-safe message.
    case 'prepareToPreview':
      console.log(`[BACKGROUND] Received request to prepare for: ${request.url}`);
      previewingUrl = request.url;
      // Immediately send a response back to the content script to confirm readiness.
      sendResponse({ ready: true });
      break;

    case 'clearPreview':
      console.log('[BACKGROUND] Clearing preview state.');
      previewingUrl = null;
      break;
    case 'preconnect':
      // This is a "fire-and-forget" request. We don't care about the response,
      // only that the browser establishes a connection to the origin.
      // Using 'HEAD' is lighter than 'GET' as it doesn't download the page body.
      console.log(`[BACKGROUND] Pre-connecting to: ${request.url}`);
      fetch(request.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
          // Ignore errors, as this is just an optimization
      });
      break;
  }
  // Return true is necessary for asynchronous sendResponse.
  return true;
});

// Open options page when the toolbar icon is clicked
browser.browserAction.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});