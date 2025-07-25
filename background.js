/**
 * @file background.js
 * @description Handles background tasks for the extension.
 * 1. Opens the options page when the toolbar icon is clicked.
 * 2. Fetches URL content to bypass X-Frame-Options limitations.
 */

// 1. Handle toolbar icon click
browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});

// 2. Listen for messages from the content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fetchUrl') {
    // Asynchronously fetch the URL
    fetch(request.url)
      .then(response => {
        // Check if the request was successful
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text(); // Get the HTML content as text
      })
      .then(html => {
        // Create a <base> tag to ensure all relative paths (CSS, JS, images)
        // in the fetched HTML resolve correctly relative to the original URL.
        const baseTag = `<base href="${request.url}">`;

        // Inject the base tag into the head of the HTML.
        // This is a simple but effective way to do it.
        const modifiedHtml = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
        
        // Send the modified HTML back to the content script
        sendResponse({ success: true, htmlContent: modifiedHtml });
      })
      .catch(error => {
        console.error("Link Previewer Fetch Error:", error);
        // Send a failure response back to the content script
        sendResponse({ 
            success: false, 
            error: `Could not load preview. The site may be down or blocking requests. (Error: ${error.message})` 
        });
      });

    // Return true to indicate that we will send a response asynchronously.
    return true;
  }
});
