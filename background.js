// background.js

const RULE_ID = 1;
// Keep track of the tab where the preview is active.
let previewingTabId = null;

// Clear session rules when the extension is installed or updated.
chrome.runtime.onInstalled.addListener(() => {
  // MODIFIED: Use updateSessionRules to clear any leftover rules.
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID]
  });
});

// Listens for messages from the content script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'prepareToPreview') {
    previewingTabId = sender.tab.id;

    // MODIFIED: Use updateSessionRules to add the rule.
    // This is the key change to fix the error.
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID], // Clear any old rule first.
      addRules: [{
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'x-frame-options', operation: 'remove' },
            { header: 'content-security-policy', operation: 'remove' },
            { header: 'x-content-type-options', operation: 'remove' }
          ]
        },
        condition: {
          // This condition now works because we are using a session rule.
          tabIds: [previewingTabId],
          resourceTypes: ['sub_frame']
        }
      }]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error(`Error adding session rule: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`[BACKGROUND] Header modification session rule added for tab: ${previewingTabId}`);
      }
      sendResponse({ ready: true });
    });

    return true; // Indicates you will send a response asynchronously.

  } else if (request.action === 'clearPreview') {
    // MODIFIED: Use updateSessionRules to clear the rule.
    if (previewingTabId !== null) {
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [RULE_ID]
      }, () => {
          if (chrome.runtime.lastError) {
              console.error(`Error removing session rule: ${chrome.runtime.lastError.message}`);
          } else {
              console.log('[BACKGROUND] Header modification session rule cleared.');
          }
      });
      previewingTabId = null;
    }

  } else if (request.action === 'preconnect') {
    // Preconnect to warm up the connection (no changes needed here).
    console.log(`[BACKGROUND] Preconnecting to: ${request.url}`);
    fetch(request.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
      // This is an optimization; ignore errors.
    });
  }
});

// Clean up the rule if the tab is closed unexpectedly.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === previewingTabId) {
    console.log(`[BACKGROUND] Preview tab ${tabId} closed, clearing session rule.`);
    // MODIFIED: Use updateSessionRules here as well.
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID]
    });
    previewingTabId = null;
  }
});

// Open options page when the toolbar icon is clicked.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});