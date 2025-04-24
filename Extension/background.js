// background.js V2.2 - Inject dedicated listener script, with debug logs

const STORAGE_KEY = 'allowedBaseUrls';
const CONTEXT_MENU_ID_INJECT = "uspiInjectValue";
const CONTEXT_MENU_ID_CLICK = "uspiClickElement";
const PLACEHOLDER_VALUE = "{{value}}"; // Simple placeholder for V1

// --- Initialization ---
chrome.runtime.onInstalled.addListener((details) => {
    // Setup storage
    if (details.reason === 'install') {
        chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => {
            console.log("USPI: Initialized allowed URLs storage.");
        });
    } else if (details.reason === 'update') {
        console.log("USPI: Extension updated.");
    }
    // Setup Context Menus (runs on install and update)
    setupContextMenus();
});

// Also setup context menus on browser startup
chrome.runtime.onStartup.addListener(() => {
    console.log("USPI: Browser startup detected.");
    setupContextMenus();
});

function setupContextMenus() {
    // Use removeAll to prevent duplicates, then recreate
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
             console.warn("USPI: Error removing existing context menus:", chrome.runtime.lastError.message);
        }
        // Inject Value Menu Item
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_INJECT,
            title: "Add to Injector: Set Value (" + PLACEHOLDER_VALUE + ")",
            contexts: ["editable"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating inject menu:", chrome.runtime.lastError.message); });

        // Click Element Menu Item
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_CLICK,
            title: "Add to Injector: Click Element",
            contexts: ["page", "frame", "link", "image", "video", "audio", "selection"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating click menu:", chrome.runtime.lastError.message); });

        console.log("USPI: Context menus creation attempted.");
    });
}

// --- URL Checking & Script Injection (MODIFIED) ---
async function checkAndInject(tabId, url) {
    if (!url || !url.startsWith('http')) {
        return; // Ignore invalid URLs (chrome://, file://, etc.)
    }
    try {
        const data = await chrome.storage.sync.get(STORAGE_KEY);
        const allowedUrls = data[STORAGE_KEY] || [];
        // Ensure allowedUrls is an array
        if (!Array.isArray(allowedUrls)) {
             console.error("USPI: Allowed URLs from storage is not an array:", allowedUrls);
             return;
        }
        const urlMatches = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && url.startsWith(baseUrl));

        if (urlMatches) {
            console.log(`USPI: URL ${url} matches. Injecting listener and content scripts.`);

            // Inject listener script FIRST (or concurrently)
            // Use try-catch around individual injections for better error isolation
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['listener.js'] // Inject the new listener file
                });
                 // console.log("USPI: Listener script injected successfully.");
            } catch (err) {
                console.warn(`USPI: Listener script injection failed for tab ${tabId}:`, err?.message || err);
                // Decide if we should proceed if listener fails? Probably not for context menu.
                // return; // Maybe stop here if listener is essential
            }

            // Inject main processing script
            try {
                 await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                 });
                 // console.log("USPI: Content script injected successfully.");
            } catch(err) {
                console.warn(`USPI: Content script injection failed for tab ${tabId}:`, err?.message || err);
            }

        } else {
            // console.log(`USPI: URL ${url} does not match allowed list.`);
        }
    } catch (error) {
        console.error("USPI: Error during checkAndInject:", error);
    }
}

// Listen for tab updates to inject scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Inject when page loading is complete and it has a URL
    // Using 'complete' status is generally reliable
    if (changeInfo.status === 'complete' && tab.url) {
        // console.log(`USPI: Tab ${tabId} updated, status complete, URL: ${tab.url}`);
        checkAndInject(tabId, tab.url);
    }
});

// --- Context Menu Click Handler (WITH ENHANCED LOGGING from previous step) ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log("USPI: Context menu clicked:", info, "Tab:", tab); // Log initial click info

    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http')) {
        console.warn("USPI: Context menu clicked on invalid tab/URL.");
        return; // Ignore clicks where tab info isn't valid
    }

    const actionType = (info.menuItemId === CONTEXT_MENU_ID_INJECT) ? 'inject' : 'click';
    console.log("USPI: Determined action type:", actionType); // Log action type

    // Inject a script to get the identifier for the right-clicked element
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getElementIdentifier, // Function defined below
        // args: [] // No args needed
    })
    .then(async (results) => {
        // --- Log Entering .then() ---
        console.log("USPI: executeScript .then() block entered. Results:", JSON.stringify(results));

        // Check for errors or invalid results structure more robustly
        if (chrome.runtime.lastError || !results || results.length === 0 || !results[0] || typeof results[0].result === 'undefined') {
            // --- Log Failure Reason ---
            console.error("USPI: Failed initial results check.", "lastError:", chrome.runtime.lastError, "results:", results);
            notifyUser(tab.id, "Error: Could not get valid identifier from page.");
            return;
        }

        // Now safe to access results[0].result
        const identifierInfo = results[0].result; // This could be null if getElementIdentifier failed

        // --- Log Identifier Info ---
        console.log("USPI: Raw IdentifierInfo received from content script:", JSON.stringify(identifierInfo));

        // Check if the identifier function actually succeeded finding something
        if (!identifierInfo) {
             // --- Log Failure Reason ---
            console.log("USPI: IdentifierInfo is null/falsy. Element identification failed in content script.");
            notifyUser(tab.id, "Element Identification Failed: Cannot find a stable ID or unique class selector for this element.");
            return;
        }

        console.log("USPI: Passed identifier checks. IdentifierInfo:", JSON.stringify(identifierInfo));

        // --- Construct Parameter ---
        let paramKey = '';
        if (identifierInfo.type === 'id') {
            paramKey = identifierInfo.identifier;
        } else if (identifierInfo.type === 'css') {
            paramKey = `css:${identifierInfo.identifier}`;
        } else {
             console.error("USPI: Unknown identifier type received:", identifierInfo.type);
             notifyUser(tab.id, "Error: Unknown identifier type.");
             return;
        }
        console.log("USPI: Constructed paramKey:", paramKey);

        const paramValue = (actionType === 'inject') ? PLACEHOLDER_VALUE : 'click';
        console.log("USPI: Determined paramValue:", paramValue);

        // URL encode key and value - important if identifiers ever contain special chars
        const encodedKey = encodeURIComponent(paramKey);
        const encodedValue = encodeURIComponent(paramValue);
        const newParam = `${encodedKey}=${encodedValue}`;
        console.log("USPI: Constructed newParam:", newParam);

        // --- Append to URL ---
        const currentUrl = tab.url;
        let newUrl = '';
        const urlParts = currentUrl.split('?');
        const base = urlParts[0];
        const existingQuery = urlParts[1] || '';

        if (existingQuery) {
            // Append with '&' if query already exists
            newUrl = `${base}?${existingQuery}&${newParam}`;
        } else {
            // Start query with '?' if none exists
            newUrl = `${base}?${newParam}`;
        }
        console.log("USPI: Constructed newUrl:", newUrl);

        // --- ADD LOG Before Copy ---
        console.log("USPI: Attempting to copy this URL:", newUrl);

        // --- Copy to Clipboard ---
        try {
            // Check if clipboard API is available
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                 console.error("USPI: navigator.clipboard.writeText API is not available in this context.");
                 notifyUser(tab.id, "Error: Clipboard API not available.");
                 return;
            }
            // Write the text
            await navigator.clipboard.writeText(newUrl);
            // --- Log Success ---
            console.log("USPI: Clipboard writeText successful. URL copied:", newUrl);
            notifyUser(tab.id, "Injector step added. Full URL copied to clipboard!");
        } catch (err) {
             // --- Log Error ---
            console.error("USPI: Clipboard write error:", err);
            // Provide more specific error message if possible
            let errorMsg = "Error: Failed to copy URL to clipboard.";
            if (err.name === 'NotAllowedError') {
                errorMsg += " Browser permissions might be denied or context is insecure.";
            } else if (err.name === 'SecurityError') {
                errorMsg += " Browser security settings might be preventing clipboard access.";
            } else {
                 errorMsg += ` (${err.name}: ${err.message})`; // Add specific error details
            }
            notifyUser(tab.id, errorMsg + " Check background console.");
        }

    })
    .catch(err => { // --- Catch Block for the whole promise chain ---
        console.error("USPI: Error during executeScript promise chain:", err);
        notifyUser(tab.id, "Error: Failed during script execution or processing. Check background console.");
    });
});


// --- Injected Function to Get Identifier (Remains defined in background.js) ---
// This function is stringified and executed in the context of the web page
function getElementIdentifier() {
    // Access the element stored by listener.js
    const element = window.lastRightClickedElement;
    // Log inside the injected function's context for debugging
    console.log("USPI (Content Script - getElementIdentifier): Element received:", element);

    if (!element) {
         console.log("USPI (Content Script - getElementIdentifier): No element found (window.lastRightClickedElement is null/undefined).");
         return null; // Explicitly return null if element is missing
    }

    // --- Strategy 1: Check for a potentially stable ID ---
    if (element.id) {
        const id = element.id;
        console.log("USPI (Content Script - getElementIdentifier): Checking ID:", id);
        // Heuristics to avoid generated IDs
        const looksGenerated = /([a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{12,})|(-{2,}\d+)|(_ngcontent-)|(ember\d+)|(^[a-zA-Z]{1,2}\d+$)/i.test(id);
        const looksLikeGuidOrLong = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(id) || id.length >= 40;
        if (id.length > 0 && !looksGenerated && !looksLikeGuidOrLong) { // Ensure not empty and passes checks
             console.log("USPI (Content Script - getElementIdentifier): Found stable ID:", id);
             // Return serializable object
             return { type: 'id', identifier: id };
        } else {
             console.log("USPI (Content Script - getElementIdentifier): ID looks generated or unstable:", id);
        }
    } else {
         console.log("USPI (Content Script - getElementIdentifier): Element has no ID.");
    }

    // --- Strategy 2: Check for unique class combination ---
    if (element.classList && element.classList.length > 0) {
        console.log("USPI (Content Script - getElementIdentifier): Checking classes:", element.classList);
        // Filter out potentially dynamic classes (adjust heuristics as needed)
        const stableClasses = Array.from(element.classList).filter(cls => !!cls && cls.length > 1 && !cls.startsWith('_') && !/\d/.test(cls));

        if (stableClasses.length > 0) {
             console.log("USPI (Content Script - getElementIdentifier): Stable classes found:", stableClasses);
             // Construct selector, ensuring proper escaping
             const selector = '.' + stableClasses.map(cls => cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&')).join('.');
             console.log("USPI (Content Script - getElementIdentifier): Testing class selector:", selector);
             try {
                // Check uniqueness within the document
                const matches = document.querySelectorAll(selector);
                if (matches.length === 1 && matches[0] === element) {
                    console.log("USPI (Content Script - getElementIdentifier): Found unique class selector:", selector);
                    // Return serializable object
                    return { type: 'css', identifier: selector };
                } else {
                     console.log(`USPI (Content Script - getElementIdentifier): Class selector "${selector}" is not unique (${matches.length} matches).`);
                }
             } catch (e) {
                 // Catch potential errors from querySelectorAll (e.g., invalid selector)
                 console.warn(`USPI (Content Script - getElementIdentifier): Error testing class selector "${selector}":`, e);
             }
        } else {
             console.log("USPI (Content Script - getElementIdentifier): No stable classes identified.");
        }
    } else {
         console.log("USPI (Content Script - getElementIdentifier): Element has no classes.");
    }

    // --- Strategy 3: (Future) Add more sophisticated selectors ---

    console.log("USPI (Content Script - getElementIdentifier): Failed to find stable ID or unique class selector.");
    return null; // Explicitly return null if no reliable identifier found
}


// --- Helper: Show Notification ---
function notifyUser(tabId, message) {
    console.log(`USPI: Sending notification: "${message}" for tabId: ${tabId}`); // Log notification attempt
    try {
        // Use a unique ID for each notification to prevent them from replacing each other
        const notificationId = `uspi-notify-${Date.now()}`;
        chrome.notifications.create(
            notificationId,
            {
                type: 'basic',
                iconUrl: 'icons/icon48.png', // Ensure this path is correct
                title: 'Universal Search Parameter Injector',
                message: message,
                priority: 0 // -2 to 2, 0 is default
            },
            (createdId) => {
                if (chrome.runtime.lastError) {
                    console.error("USPI: Error creating notification:", chrome.runtime.lastError.message);
                } else if (createdId) {
                    // console.log("USPI: Notification created with ID:", createdId);
                    // Optional: Clear notification after a few seconds
                     setTimeout(() => { chrome.notifications.clear(createdId); }, 5000);
                } else {
                     console.warn("USPI: Notification creation callback without ID and no error.");
                }
            }
        );
    } catch (e) {
        // Catch synchronous errors, although most errors will be in the callback
        console.error("USPI: Exception caught creating notification:", e);
    }
}