// background.js

const DEBUG = false;
function debug(msg) {
  if (DEBUG)
    console.log(msg);
}

const RULE_ID = 1;
// Use a Set to store the IDs of all tabs with an active preview.
const previewingTabIds = new Set();

// Define the rule object here to reuse it.
const headerRule = {
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
    resourceTypes: ['sub_frame', 'xmlhttprequest']
  }
};

// --- Helper Functions to Manage the DNR Rule ---

/**
 * Enables the header modification rule.
 * Checks if the rule is already active to avoid redundant API calls.
 */
async function enableRule() {
  // 1. Get all currently active session rules.
  const existingRules = await chrome.declarativeNetRequest.getSessionRules();

  // 2. Check if a rule with our ID is already in the list.
  if (existingRules.some(rule => rule.id === RULE_ID)) {
    // debug('[BACKGROUND] Rule is already active. No action needed.');
    return; // Exit if the rule already exists.
  }

  // 3. If the rule is not found, add it.
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [headerRule]
  });
  debug('[BACKGROUND] Header modification rule ENABLED.');
}


/**
 * Disables the header modification rule. This function is idempotent.
 */
async function disableRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID]
  });
  debug('[BACKGROUND] Header modification rule DISABLED.');
}


// --- Event Listeners ---

// On installation, clear any existing session rules.
chrome.runtime.onInstalled.addListener(() => {
  disableRule();
});

// Listens for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'prepareToPreview') {
    const tabId = sender.tab.id;
    debug(`[BACKGROUND] Activating preview for tab: ${tabId}`);
    previewingTabIds.add(tabId);
    // Enable the rule immediately since this tab is now actively previewing.
    enableRule();
    sendResponse({ ready: true });
    return;

  } else if (request.action === 'clearPreview') {
    const tabId = sender.tab.id;
    if (previewingTabIds.has(tabId)) {
      debug(`[BACKGROUND] Deactivating preview for tab: ${tabId}`);
      previewingTabIds.delete(tabId);
      // After clearing a preview, check if the currently active tab is still
      // a preview tab. If not, disable the rule.
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        if (!activeTabs[0] || !previewingTabIds.has(activeTabs[0].id)) {
          disableRule();
        }
      });
    }
  } else if (request.action === 'preconnect') {
    // Preconnect to warm up the connection (no changes needed here).
    fetch(request.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
      // This is an optimization; ignore errors.
    });
  }
});

/**
 * Fired when the active tab in a window changes. This is the core logic
 * for enabling/disabling the rule on tab switches.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (previewingTabIds.has(activeInfo.tabId)) {
    debug(`[BACKGROUND] Switched TO a preview tab (${activeInfo.tabId}).`);
    await enableRule();
  } else {
    debug(`[BACKGROUND] Switched AWAY from a preview tab.`);
    await disableRule();
  }
});

// Clean up when a tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  // Check if the closed tab was in our preview set.
  if (previewingTabIds.has(tabId)) {
    previewingTabIds.delete(tabId);
    debug(`[BACKGROUND] Preview tab ${tabId} closed, removed from set.`);
    // If this was the very last previewing tab, ensure the rule is disabled.
    if (previewingTabIds.size === 0) {
      debug('[BACKGROUND] Last preview tab closed. Disabling rule.');
      disableRule();
    }
  }
});