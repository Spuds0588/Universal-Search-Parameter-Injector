// background.js V2.7 - Enhanced element identification order (aria-label, id, data-testid, name, placeholder, class)

const STORAGE_KEY = 'allowedBaseUrls';
const CONTEXT_MENU_ID_INJECT = "uspiInjectValue";
const CONTEXT_MENU_ID_CLICK = "uspiClickElement";
const PLACEHOLDER_VALUE = "search-text-here"; // Use clearer placeholder

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
    setupContextMenus();
});

function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) { console.warn("USPI: Error removing menus:", chrome.runtime.lastError.message); }
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_INJECT,
            title: "Add to Injector: Set Value (" + PLACEHOLDER_VALUE + ")",
            contexts: ["editable"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating inject menu:", chrome.runtime.lastError.message); });
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_CLICK,
            title: "Add to Injector: Click Element",
            contexts: ["page", "frame", "link", "image", "video", "audio", "selection"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating click menu:", chrome.runtime.lastError.message); });
        // console.log("USPI: Context menus creation attempted.");
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
    // console.log("USPI: Context menu clicked:", info, "Tab ID:", tab?.id);

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
         console.error("USPI: Error checking allowlist:", error);
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
        // console.log("USPI: executeScript .then() block entered. Results:", JSON.stringify(results));

        if (chrome.runtime.lastError || !results || results.length === 0 || typeof results[0]?.result === 'undefined') {
            console.error("USPI: Failed initial results check.", "lastError:", chrome.runtime.lastError, "results:", results);
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nCould not get valid result from page."]}).catch(err=>console.warn(err));
            return;
        }

        const identifierInfo = results[0].result; // Could be null
        // console.log("USPI: Raw IdentifierInfo received:", JSON.stringify(identifierInfo));

        if (!identifierInfo || typeof identifierInfo !== 'object' || !identifierInfo.type || !identifierInfo.identifier) {
             console.log("USPI: IdentifierInfo is null or invalid. Identification failed.");
             chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nElement Identification Failed. Could not find a reliable identifier."]}).catch(err=>console.warn(err));
             return;
        }

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

        const paramValue = (actionType === 'inject') ? PLACEHOLDER_VALUE : 'click';
        const encodedKey = encodeURIComponent(paramKey);
        const encodedValue = encodeURIComponent(paramValue);
        const newParam = `${encodedKey}=${encodedValue}`;
        // console.log("USPI: Constructed newParam:", newParam);

        // --- Append to URL ---
        const currentUrl = tab.url;
        let newUrl = '';
        const urlParts = currentUrl.split('?');
        const base = urlParts[0];
        const existingQuery = urlParts[1] || '';
        if (existingQuery) { newUrl = `${base}?${existingQuery}&${newParam}`; }
        else { newUrl = `${base}?${newParam}`; }
        // console.log("USPI: Constructed newUrl:", newUrl);

        // --- Reload the tab with the new URL ---
        console.log(`USPI: Reloading tab ${tab.id} with new URL: ${newUrl}`);
        chrome.tabs.update(tab.id, { url: newUrl }, () => {
             if (chrome.runtime.lastError) {
                  console.error("USPI: Error reloading tab:", chrome.runtime.lastError.message);
                  chrome.tabs.get(tab.id, (existingTab) => { if (existingTab) { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nFailed to reload page."]}).catch(err=>console.warn(err)); } });
             }
        });

    })
    .catch(err => {
        console.error("USPI: Error during executeScript promise chain:", err);
        if (!err.message.includes("No tab with id")) {
             chrome.tabs.get(tab.id, (existingTab) => { if (existingTab) { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nFailed during script execution/processing."]}).catch(errInner=>console.warn(errInner)); } });
        }
    });
});


// --- Injected Function to Get Identifier (MODIFIED with new order and checks) ---
function getElementIdentifier() {
    const clickedElement = window.lastRightClickedElement;
    if (!clickedElement) { return null; }

    // Use closest() to find the most relevant interactive element near the click
    const targetSelector = 'input, textarea, button, a, [role="button"], [contenteditable="true"]';
    const element = clickedElement.closest(targetSelector);
    if (!element) { console.log("USPI Identifier: Could not find relevant element near click."); return null; }

    // --- Function to check attribute uniqueness ---
    function checkAttributeUniqueness(el, attrName, attrValue) {
        if (!attrValue || attrValue.trim().length === 0) return null; // Skip empty attributes

        // Escape attribute value for CSS selector
        let escapedValue = attrValue;
        let quoteChar = '"'; // Default to double quotes
        if (attrValue.includes('"') && attrValue.includes("'")) { escapedValue = attrValue.replace(/"/g, '\\"'); }
        else if (attrValue.includes('"')) { quoteChar = "'"; }

        const selector = `[${attrName}=${quoteChar}${escapedValue}${quoteChar}]`;
        try {
            const matches = document.querySelectorAll(selector);
            if (matches.length === 1 && matches[0] === el) {
                console.log(`USPI Identifier: Found unique [${attrName}] selector:`, selector);
                return { type: 'css', identifier: selector };
            }
        } catch (e) { console.warn(`USPI Identifier: Error testing [${attrName}] selector "${selector}":`, e); }
        return null; // Not unique or error
    }

    // --- Identification Priority Order ---

    // 1. ARIA Label
    let result = checkAttributeUniqueness(element, 'aria-label', element.getAttribute('aria-label'));
    if (result) return result;

    // 2. Stable & Unique ID
    if (element.id) {
        const id = element.id;
        const looksGenerated = /([a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{12,})|(-{2,}\d+)|(_ngcontent-)|(ember\d+)|(^[a-zA-Z]{1,2}\d+$)/i.test(id);
        const looksLikeGuidOrLong = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(id) || id.length >= 40;
        if (id.length > 0 && !looksGenerated && !looksLikeGuidOrLong) {
             try {
                 const idSelector = `#${id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`; // Escape ID
                 const matches = document.querySelectorAll(idSelector);
                 if (matches.length === 1 && matches[0] === element) {
                     console.log("USPI Identifier: Found stable & unique ID:", id);
                     return { type: 'id', identifier: id };
                 }
             } catch(e) { console.warn(`USPI Identifier: Error testing ID selector "#${id}":`, e); }
        }
    }

    // 3. Unique data-testid
    result = checkAttributeUniqueness(element, 'data-testid', element.getAttribute('data-testid'));
    if (result) return result;

    // 4. Unique name (relevant for form elements)
    const tagName = element.tagName.toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName)) {
        result = checkAttributeUniqueness(element, 'name', element.getAttribute('name'));
        if (result) return result;
    }

    // 5. Unique placeholder (relevant for input/textarea)
    if (['INPUT', 'TEXTAREA'].includes(tagName)) {
        result = checkAttributeUniqueness(element, 'placeholder', element.getAttribute('placeholder'));
        if (result) return result;
    }

    // 6. Unique Stable Class Combination
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

    // --- Failed ---
    console.log("USPI Identifier: Failed identification for element:", element);
    return null;
}

// --- REMOVED notifyUser function ---