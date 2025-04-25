// background.js V2.7 - Changed PLACEHOLDER_VALUE constant

const STORAGE_KEY = 'allowedBaseUrls';
const CONTEXT_MENU_ID_INJECT = "uspiInjectValue";
const CONTEXT_MENU_ID_CLICK = "uspiClickElement";
const PLACEHOLDER_VALUE = "search-text-here"; // Use clearer placeholder text

// --- Initialization ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => {
            console.log("USPI: Initialized allowed URLs storage.");
        });
    } else if (details.reason === 'update') {
        console.log("USPI: Extension updated.");
    }
    setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
    // console.log("USPI: Browser startup detected."); // Less verbose
    setupContextMenus();
});

function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) { console.warn("USPI: Error removing menus:", chrome.runtime.lastError.message); }
        // Update title to reflect the new placeholder
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_INJECT,
            title: "Add to Injector: Set Value (" + PLACEHOLDER_VALUE + ")", // Title uses the constant
            contexts: ["editable"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating inject menu:", chrome.runtime.lastError.message); });
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_CLICK,
            title: "Add to Injector: Click Element",
            contexts: ["page", "frame", "link", "image", "video", "audio", "selection"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating click menu:", chrome.runtime.lastError.message); });
        // console.log("USPI: Context menus creation attempted."); // Less verbose
    });
}

// --- URL Checking & Script Injection ---
async function checkAndInject(tabId, url) {
    if (!url || !url.startsWith('http')) { return; }
    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const allowedUrls = data[STORAGE_KEY];
        if (!Array.isArray(allowedUrls)) { console.error("USPI: Allowed URLs not an array"); return; }
        const urlMatches = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && url.startsWith(baseUrl));

        if (urlMatches) {
            // Inject listener first
            try {
                await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['listener.js'] });
            } catch (err) {
                if (!err.message.includes("No tab with id")) console.warn(`USPI: Listener injection failed:`, err?.message);
            }
            // Inject content script
            try {
                 await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
            } catch(err) {
                 if (!err.message.includes("No tab with id")) console.warn(`USPI: Content injection failed:`, err?.message);
            }
        }
    } catch (error) {
        console.error("USPI: Error during checkAndInject:", error);
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        checkAndInject(tabId, tab.url);
    }
});


// --- Context Menu Click Handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // console.log("USPI: Context menu clicked:", info, "Tab ID:", tab?.id); // Less verbose

    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http')) {
        console.warn("USPI: Context menu clicked on invalid tab/URL.");
        return;
    }

    // --- Check if URL is allowed ---
    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const allowedUrls = data[STORAGE_KEY];
        if (!Array.isArray(allowedUrls)) { console.error("USPI: Allowed URLs not an array"); return; }
        const currentUrlAllowed = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && tab.url.startsWith(baseUrl));

        if (!currentUrlAllowed) {
            chrome.scripting.executeScript({
                 target: { tabId: tab.id },
                 func: (msg) => alert(msg),
                 args: [`Injector Error:\nThis site (${new URL(tab.url).hostname}) is not in the allowlist. Add it via the popup first.`]
            }).catch(err => console.warn("USPI: Failed to show non-allowed alert:", err));
            return;
        }
    } catch (error) {
         console.error("USPI: Error checking allowlist in context menu handler:", error);
         return;
    }

    const actionType = (info.menuItemId === CONTEXT_MENU_ID_INJECT) ? 'inject' : 'click';

    // --- Execute script to get the identifier OBJECT ---
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getElementIdentifier, // Using the updated function below
        injectImmediately: true
    })
    .then((results) => {
        // console.log("USPI: executeScript .then() block entered. Results:", JSON.stringify(results)); // Less verbose

        if (chrome.runtime.lastError || !results || results.length === 0 || typeof results[0]?.result === 'undefined') {
            console.error("USPI: Failed initial results check.", "lastError:", chrome.runtime.lastError, "results:", results);
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nCould not get valid result from page."]}).catch(err=>console.warn(err));
            return;
        }

        const identifierInfo = results[0].result; // Could be null
        // console.log("USPI: Raw IdentifierInfo received:", JSON.stringify(identifierInfo)); // Less verbose

        if (!identifierInfo || typeof identifierInfo !== 'object' || !identifierInfo.type || !identifierInfo.identifier) {
             console.log("USPI: IdentifierInfo is null or invalid. Identification failed.");
             chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nElement Identification Failed. Could not find stable ID, unique aria-label, or unique class selector."]}).catch(err=>console.warn(err)); // Updated error message
             return;
        }

        // console.log("USPI: Passed identifier checks. IdentifierInfo:", JSON.stringify(identifierInfo)); // Less verbose

        // --- Construct Parameter Key based on type ---
        let paramKey = '';
        if (identifierInfo.type === 'id') {
            paramKey = identifierInfo.identifier;
        } else if (identifierInfo.type === 'css') {
            paramKey = `css:${identifierInfo.identifier}`; // Add prefix for CSS selectors
        } else {
             console.error("USPI: Unknown identifier type received:", identifierInfo.type);
             chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nUnknown identifier type received."]}).catch(err=>console.warn(err));
             return;
        }

        // --- THIS IS WHERE THE CONSTANT IS USED ---
        const paramValue = (actionType === 'inject') ? PLACEHOLDER_VALUE : 'click';
        // -----------------------------------------

        const encodedKey = encodeURIComponent(paramKey);
        const encodedValue = encodeURIComponent(paramValue); // Will now encode "search-text-here"
        const newParam = `${encodedKey}=${encodedValue}`;
        // console.log("USPI: Constructed newParam:", newParam); // Less verbose

        // --- Append to URL ---
        const currentUrl = tab.url;
        let newUrl = '';
        const urlParts = currentUrl.split('?');
        const base = urlParts[0];
        const existingQuery = urlParts[1] || '';
        if (existingQuery) { newUrl = `${base}?${existingQuery}&${newParam}`; }
        else { newUrl = `${base}?${newParam}`; }
        // console.log("USPI: Constructed newUrl:", newUrl); // Less verbose

        // --- Reload the tab with the new URL ---
        console.log(`USPI: Reloading tab ${tab.id} with new URL: ${newUrl}`);
        chrome.tabs.update(tab.id, { url: newUrl }, () => {
             if (chrome.runtime.lastError) {
                  console.error("USPI: Error reloading tab:", chrome.runtime.lastError.message);
                  // Check if tab still exists before alerting
                  chrome.tabs.get(tab.id, (existingTab) => {
                      if (existingTab) { // Only alert if the tab wasn't closed
                           chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nFailed to reload page with new parameter."]}).catch(err=>console.warn(err));
                      }
                  });
             }
        });

    })
    .catch(err => {
        console.error("USPI: Error during executeScript promise chain:", err);
        if (!err.message.includes("No tab with id")) {
             // Check if tab still exists before alerting
             chrome.tabs.get(tab.id, (existingTab) => {
                  if (existingTab) {
                       chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nFailed during script execution/processing."]}).catch(errInner=>console.warn(errInner));
                  }
             });
        }
    });
});


// --- Injected Function to Get Identifier (Uses closest() and new order) ---
function getElementIdentifier() {
    const clickedElement = window.lastRightClickedElement;
    if (!clickedElement) { return null; }
    const targetSelector = 'input, textarea, button, a, [role="button"], [contenteditable="true"]';
    const element = clickedElement.closest(targetSelector);
    if (!element) {
        console.log("USPI Identifier: Could not find relevant element near click.");
        return null;
    }

    // --- Strategy 1: Unique aria-label ---
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim().length > 0) {
        let escapedLabel = ariaLabel;
        let quoteChar = '"';
        if (ariaLabel.includes('"') && ariaLabel.includes("'")) { escapedLabel = ariaLabel.replace(/"/g, '\\"'); }
        else if (ariaLabel.includes('"')) { quoteChar = "'"; }
        const selector = `[aria-label=${quoteChar}${escapedLabel}${quoteChar}]`;
        try {
            const matches = document.querySelectorAll(selector);
            if (matches.length === 1 && matches[0] === element) {
                console.log("USPI Identifier: Found unique aria-label selector:", selector);
                return { type: 'css', identifier: selector };
            }
        } catch (e) { console.warn(`USPI Identifier: Error aria-label selector "${selector}":`, e); }
    }

    // --- Strategy 2: Stable & Unique ID ---
    if (element.id) {
        const id = element.id;
        const looksGenerated = /([a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{12,})|(-{2,}\d+)|(_ngcontent-)|(ember\d+)|(^[a-zA-Z]{1,2}\d+$)/i.test(id);
        const looksLikeGuidOrLong = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(id) || id.length >= 40;
        if (id.length > 0 && !looksGenerated && !looksLikeGuidOrLong) {
             try {
                 const matches = document.querySelectorAll(`#${id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`);
                 if (matches.length === 1 && matches[0] === element) {
                     console.log("USPI Identifier: Found stable & unique ID:", id);
                     return { type: 'id', identifier: id };
                 }
             } catch(e) { console.warn(`USPI Identifier: Error ID selector "#${id}":`, e); }
        }
    }

    // --- Strategy 3: Unique Class Combination ---
    if (element.classList && element.classList.length > 0) {
        const stableClasses = Array.from(element.classList).filter(cls => !!cls && cls.length > 1 && !cls.startsWith('_') && !/\d/.test(cls) && !cls.includes(':'));
        if (stableClasses.length > 0) {
             const selector = '.' + stableClasses.map(cls => cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&')).join('.');
             try {
                const matches = document.querySelectorAll(selector);
                if (matches.length === 1 && matches[0] === element) {
                    console.log("USPI Identifier: Found unique class selector:", selector);
                    return { type: 'css', identifier: selector };
                }
             } catch (e) { /* Ignore selector errors */ }
        }
    }

    console.log("USPI Identifier: Failed identification for element:", element);
    return null;
}

// --- REMOVED notifyUser function ---