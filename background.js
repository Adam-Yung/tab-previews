// background.js

/**
 * @type {string|null}
 * Holds the URL of the page currently being previewed. This is used as a flag
 * to determine if a preview is active, which tells the onHeadersReceived
 * listener whether to modify headers.
 */
let previewingUrl = null;

/**
 * Intercepts network requests and removes security headers from responses
 * for sub_frame requests made by the preview iframe. This allows embedding
 * sites that would otherwise block it via X-Frame-Options or CSP.
 * @param {object} details - Details about the network request.
 * @returns {object} The modified headers or original headers.
 */
function headersListener(details) {
  // Only modify headers for sub_frame requests when a preview is active.
  if (details.type === 'sub_frame' && previewingUrl) {
    console.log(`[BACKGROUND] Intercepting headers for: ${details.url}`);

    const newHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase();
      // Strip headers that prevent the page from being iframed.
      return !(
        headerName === 'content-security-policy' ||
        headerName === 'x-frame-options' ||
        headerName === 'x-content-type-options'
      );
    });

    return { responseHeaders: newHeaders };
  }
  // Return original headers for all other requests.
  return { responseHeaders: details.responseHeaders };
}

// Register the webRequest listener to intercept sub_frame responses.
browser.webRequest.onHeadersReceived.addListener(
  headersListener,
  { urls: ["<all_urls>"], types: ["sub_frame"] },
  ["blocking", "responseHeaders"]
);

/**
 * Handles messages from other parts of the extension, like content scripts.
 */
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    // Sent by the content script right before creating the iframe.
    // This sets the `previewingUrl` flag to enable the header stripping logic.
    case 'prepareToPreview':
      console.log(`[BACKGROUND] Preparing to preview: ${request.url}`);
      previewingUrl = request.url;
      sendResponse({ ready: true });
      return true; // Indicates an async response.

    // Sent by the content script when the preview is closed.
    case 'clearPreview':
      console.log('[BACKGROUND] Clearing preview state.');
      previewingUrl = null;
      break;

    // Pre-connects to a URL on hover for a potential speed-up.
    case 'preconnect':
      // This is an optimization, so we fire and forget.
      // 'HEAD' is used as it's lighter than a full 'GET'.
      fetch(request.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
          // Ignore errors, this is not a critical function.
      });
      break;
  }
});