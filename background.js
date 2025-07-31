// background.js

const RULE_ID = 1;

// Clear all rules when the extension is first installed or updated.
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID]
  });
});

// Listens for messages from the content script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'prepareToPreview') {
    // Add a rule to remove headers for the specific URL.
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_ID], // First, remove any existing rule.
      addRules: [{
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'x-frame-options', operation: 'remove' },
            { header: 'content-security-policy', operation: 'remove' }
          ]
        },
        condition: {
          urlFilter: request.url, // Apply the rule only to this specific URL.
          resourceTypes: ['sub_frame']
        }
      }]
    }, () => {
      console.log(`[BACKGROUND] Header modification rule added for: ${request.url}`);
      sendResponse({ ready: true });
    });
    return true; // Indicates an async response.

  } else if (request.action === 'clearPreview') {
    // Remove the rule now that the preview is closed.
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_ID]
    }, () => {
       console.log('[BACKGROUND] Header modification rule cleared.');
    });

  } else if (request.action === 'preconnect') {
    // Preconnect to a URL to warm up the connection.
    console.log(`[BACKGROUND] Preconnecting to: ${request.url}`);
    fetch(request.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
      // This is an optimization; ignore errors.
    });
  }
});

// Open options page when the toolbar icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});