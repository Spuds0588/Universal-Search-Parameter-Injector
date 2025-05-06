// background.js V3.0 - Sequence Builder Support via Popup

const STORAGE_KEY = 'allowedBaseUrls'; // For allowlist
const CONTEXT_MENU_ID_ADD_TO_SEQUENCE = "uspiAddToSequence";
const PLACEHOLDER_VALUE = "search-text-here";

// --- Initialization ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => { console.log("USPI: Initialized allowlist storage."); });
        chrome.storage.local.clear(); // Clear any old local storage on new install
    } else if (details.reason === 'update') { console.log("USPI: Extension updated."); }
    setupContextMenus();
});
chrome.runtime.onStartup.addListener(setupContextMenus);

function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) { console.warn("USPI: Error removing menus:", chrome.runtime.lastError.message); }
        // Main context menu item to add to sequence
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_ADD_TO_SEQUENCE,
            title: "Add to Injector Sequence...",
            contexts: ["page", "frame", "link", "image", "video", "audio", "selection", "editable"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating main context menu:", chrome.runtime.lastError.message); });
        console.log("USPI: Context menu creation attempted.");
    });
}

// --- URL Checking & Script Injection (No changes from v2.9) ---
async function checkAndInject(tabId, url) { /* ... same as v2.9 ... */
    const injectionCheckKey = `inject_check_${tabId}`; const lastCheck = await chrome.storage.local.get(injectionCheckKey); const now = Date.now(); if (lastCheck[injectionCheckKey] && (now - lastCheck[injectionCheckKey] < 500)) { return; } await chrome.storage.local.set({ [injectionCheckKey]: now });
    if (!url || !url.startsWith('http')) { return; } try { const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] }); const allowedUrls = data[STORAGE_KEY]; if (!Array.isArray(allowedUrls)) { console.error("USPI: Allowed URLs not an array"); return; } const urlMatches = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && url.startsWith(baseUrl)); if (urlMatches) { console.log(`USPI: Injecting scripts for matched URL: ${url}`); try { await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['listener.js'] }); } catch (err) { if (!err.message.includes("No tab with id") && !err.message.includes("Cannot access") && !err.message.includes("Could not establish connection")) console.warn(`USPI: Listener injection failed:`, err?.message); } try { await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }); } catch(err) { if (!err.message.includes("No tab with id") && !err.message.includes("Cannot access") && !err.message.includes("Could not establish connection")) console.warn(`USPI: Content injection failed:`, err?.message); } } } catch (error) { console.error("USPI: Error during checkAndInject:", error); }
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { if (tab.url && tab.url.startsWith('http') && tab.status === 'complete') { checkAndInject(tabId, tab.url); } });


// --- Context Menu Click Handler (MODIFIED for sequence builder) ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID_ADD_TO_SEQUENCE) return;
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http')) { console.warn("USPI: Context menu on invalid tab."); return; }

    // Check if URL is allowed
    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const allowedUrls = data[STORAGE_KEY] || [];
        const currentUrlAllowed = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && tab.url.startsWith(baseUrl));
        if (!currentUrlAllowed) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: [`Injector Error:\nSite not allowlisted. Add via popup.`] }).catch(err => console.warn(err));
            return;
        }
    } catch (error) { console.error("USPI: Error checking allowlist:", error); return; }

    // Get identifier for the right-clicked element
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getElementIdentifier,
        injectImmediately: true
    })
    .then(async (results) => {
        if (chrome.runtime.lastError || !results || results.length === 0 || typeof results[0]?.result === 'undefined') {
            console.error("USPI: Failed to get element identifier from page.", chrome.runtime.lastError);
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nCould not identify element."] }).catch(err => console.warn(err));
            return;
        }
        const identifierInfo = results[0].result;
        if (!identifierInfo) {
            console.log("USPI: Element identification returned null.");
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nElement identification failed (no stable identifier found)."] }).catch(err => console.warn(err));
            return;
        }

        // Determine suggested action based on element type (and context info if available)
        // For now, editable suggests inject, otherwise click.
        let suggestedActionType = 'click';
        // info.editable is true if context was "editable"
        if (info.editable || (identifierInfo.elementType && ['INPUT', 'TEXTAREA'].includes(identifierInfo.elementType.toUpperCase())) ) {
            suggestedActionType = 'inject';
        }

        const newStep = {
            identifier: identifierInfo.type === 'id' ? identifierInfo.identifier : `css:${identifierInfo.identifier}`,
            type: suggestedActionType, // 'inject' or 'click' (popup will confirm/change)
            value: suggestedActionType === 'inject' ? PLACEHOLDER_VALUE : 'click', // Default value
            // Add element description for display in popup?
            description: identifierInfo.description || identifierInfo.identifier // For popup display
        };

        // Store this new step temporarily, keyed by tabId, for the popup to pick up
        const tempStorageKey = 'uspi_new_step_for_tab_' + tab.id;
        await chrome.storage.local.set({ [tempStorageKey]: { step: newStep, timestamp: Date.now() } });

        // Programmatically open the popup
        chrome.action.openPopup({}, (popupWindow) => {
            if (chrome.runtime.lastError) {
                console.error("USPI: Error opening popup:", chrome.runtime.lastError.message);
                // Fallback: maybe alert user to open popup manually
                chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Please open the extension popup to continue building the sequence."] }).catch(err => console.warn(err));
            } else {
                // console.log("USPI: Popup opened for sequence building.");
            }
        });
    })
    .catch(err => {
        console.error("USPI: Error in context menu executeScript chain:", err);
    });
});


// --- Message Listener from Popup ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "buildAndReload") {
        if (!request.tabId || !request.baseUrl || !Array.isArray(request.sequence)) {
            console.error("USPI: Invalid buildAndReload request:", request);
            sendResponse({ status: "error", message: "Invalid request data." });
            return true; // Indicate async response
        }

        const sequence = request.sequence;
        let paramsArray = [];

        sequence.forEach(step => {
            let key = step.identifier; // This should already be prefixed with css: if needed, or be an ID, or special command
            let value = step.value;

            // Handle special command types correctly for key
            if (step.command === 'wait') key = 'wait';
            if (step.command === 'pressEnter') key = 'pressEnter';

            paramsArray.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        });

        const queryString = paramsArray.join('&');
        let newUrl = request.baseUrl; // Base URL (path included, no query/hash)

        // Append our query string. If original URL had other params, they are lost with this simplified approach
        // To preserve them, popup would need to send original query, and background merge them.
        // For now, let's assume the popup gives us a clean base URL for the sequence.
        if (queryString) {
            newUrl = `${newUrl}${newUrl.includes('?') ? '&' : '?'}${queryString}`;
        }

        console.log(`USPI: Reloading tab ${request.tabId} from popup sequence: ${newUrl}`);
        chrome.tabs.update(request.tabId, { url: newUrl }, () => {
            if (chrome.runtime.lastError) {
                console.error("USPI: Error reloading tab from popup:", chrome.runtime.lastError.message);
                sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            } else {
                sendResponse({ status: "success" });
            }
        });
        return true; // Indicate async response
    }
    return false; // For other messages
});


// --- Injected Function to Get Identifier (from v2.8, returns more info) ---
function getElementIdentifier() {
    const clickedElement = window.lastRightClickedElement; if (!clickedElement) { return null; }
    const targetSelector = 'input, textarea, button, a, [role="button"], [contenteditable="true"]';
    const element = clickedElement.closest(targetSelector); if (!element) { return null; }

    function checkAttributeUniqueness(el, attrName, attrValue) { /* ... same as v2.8 ... */
         if (!attrValue || attrValue.trim().length === 0) return null; let escapedValue = attrValue; let quoteChar = '"'; if (attrValue.includes('"') && attrValue.includes("'")) { escapedValue = attrValue.replace(/"/g, '\\"'); } else if (attrValue.includes('"')) { quoteChar = "'"; } const selector = `[${attrName}=${quoteChar}${escapedValue}${quoteChar}]`; try { const matches = document.querySelectorAll(selector); if (matches.length === 1 && matches[0] === el) { console.log(`USPI Identifier: Found unique [${attrName}] selector:`, selector); return { type: 'css', identifier: selector, description: `Element with ${attrName}="${attrValue.substring(0,30)}..."` }; } } catch (e) { console.warn(`USPI Identifier: Error testing [${attrName}] selector "${selector}":`, e); } return null;
    }
    let result = null; let description = ''; const elTagName = element.tagName.toLowerCase();

    // Priority order
    result = checkAttributeUniqueness(element, 'aria-label', element.getAttribute('aria-label')); if (result) return result;
    if (element.id) { /* ... same ID check as v2.8 ... */
        const id = element.id; const commonShortIds = ['q', 's', 'id', 'key', 'kw', 'query', 'search', 'input', 'text', 'button', 'submit', 'username', 'password']; const looksShortAndMaybeBad = (id.length <= 2 && !commonShortIds.includes(id.toLowerCase())); const looksGenerated = /([a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{12,})|(-{2,}\d+)|(_ngcontent-)|(ember\d+)|(^[a-zA-Z]{1,2}\d+$)/i.test(id); const looksLikeGuidOrLong = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(id) || id.length >= 40;
        if (id.length > 0 && !looksShortAndMaybeBad && !looksGenerated && !looksLikeGuidOrLong) { try { const idSelector = `#${id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`; const matches = document.querySelectorAll(idSelector); if (matches.length === 1 && matches[0] === element) { console.log("USPI Identifier: Found stable & unique ID:", id); return { type: 'id', identifier: id, description: `Element with ID #${id}`, elementType: elTagName }; } } catch(e) { console.warn(`USPI Identifier: Error ID selector "#${id}":`, e); } }
    }
    result = checkAttributeUniqueness(element, 'data-testid', element.getAttribute('data-testid')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-cy', element.getAttribute('data-cy')); if (result) return result; result = checkAttributeUniqueness(element, 'data-cypress', element.getAttribute('data-cypress')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-qa', element.getAttribute('data-qa')); if (result) return result; result = checkAttributeUniqueness(element, 'data-qa-id', element.getAttribute('data-qa-id')); if (result) return result;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName.toUpperCase())) { result = checkAttributeUniqueness(element, 'name', element.getAttribute('name')); if (result) return result; }
    if (['INPUT', 'TEXTAREA'].includes(element.tagName.toUpperCase())) { result = checkAttributeUniqueness(element, 'placeholder', element.getAttribute('placeholder')); if (result) return result; }
    result = checkAttributeUniqueness(element, 'data-component', element.getAttribute('data-component')); if (result) return result; result = checkAttributeUniqueness(element, 'data-element', element.getAttribute('data-element')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-target', element.getAttribute('data-target')); if (result) return result; result = checkAttributeUniqueness(element, 'data-action', element.getAttribute('data-action')); if (result) return result;
    if (element.classList && element.classList.length > 0) { /* ... same class check as v2.8 ... */
        const stableClasses = Array.from(element.classList).filter(cls => !!cls && cls.length > 1 && !cls.startsWith('_') && !/\d/.test(cls) && !cls.includes(':')); if (stableClasses.length > 0) { const selector = '.' + stableClasses.map(cls => cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&')).join('.'); try { const matches = document.querySelectorAll(selector); if (matches.length === 1 && matches[0] === element) { console.log("USPI Identifier: Found unique class selector:", selector); return { type: 'css', identifier: selector, description: `Element with classes "${stableClasses.join(' ')}"` , elementType: elTagName}; } } catch (e) { /* Ignore */ } }
    }
    description = `Right-clicked ${elTagName}`;
    if(element.textContent && element.textContent.trim().length > 0 && element.textContent.trim().length < 30) description += ` with text "${element.textContent.trim().substring(0,27)}..."`;
    else if (element.value && typeof element.value === 'string' && element.value.trim().length > 0 && element.value.trim().length < 30) description += ` with value "${element.value.trim().substring(0,27)}..."`;

    console.log("USPI Identifier: Failed stable identification, returning generic info for element:", element);
    // Fallback if no other good identifier, try to give some description for popup
    return { type: 'css', identifier: 'selector_needed_manually', description: description, elementType: elTagName };
}