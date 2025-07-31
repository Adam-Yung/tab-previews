// background.js

let previewingUrl = null;

/**
 * The core logic: Intercepts network requests intended for the preview iframe.
 * It strips security headers that would prevent the page from being displayed.
 */
function headersListener(details) {
  // MODIFIED: Instead of checking for a specific URL, we now modify headers
  // for ANY sub_frame request as long as a preview is active (previewingUrl is not null).
  if (details.type === 'sub_frame' && previewingUrl) {
    console.log(`[BACKGROUND] Intercepted headers for a link inside the preview: ${details.url}`);

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

    // REMOVED: We no longer clear the previewingUrl here.
    // It will be cleared only when the 'clearPreview' message is received.

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
      return true; // Keep the message channel open for the async response.
    case 'clearPreview':
      console.log('[BACKGROUND] Clearing preview state.');
      previewingUrl = null; // This now becomes the sole place where previewingUrl is cleared.
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
});

// Open options page when the toolbar icon is clicked
browser.browserAction.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});