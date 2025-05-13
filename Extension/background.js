// background.js V3.1 - Smart Select Option Handling via Popup

const STORAGE_KEY = 'allowedBaseUrls'; // For allowlist
const CONTEXT_MENU_ID_ADD_TO_SEQUENCE = "uspiAddToSequence";
const PLACEHOLDER_VALUE = "search-text-here";

// --- Initialization ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => { console.log("USPI: Initialized allowlist storage."); });
        chrome.storage.local.clear(() => { console.log("USPI: Local storage cleared on install."); }); // Clear sequence drafts
    } else if (details.reason === 'update') {
        console.log("USPI: Extension updated.");
    }
    setupContextMenus();
});
chrome.runtime.onStartup.addListener(setupContextMenus);

function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) { console.warn("USPI: Error removing menus:", chrome.runtime.lastError.message); }
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID_ADD_TO_SEQUENCE,
            title: "Add to Injector Sequence...",
            contexts: ["page", "frame", "link", "image", "video", "audio", "selection", "editable"]
        }, () => { if (chrome.runtime.lastError) console.error("USPI: Error creating main context menu:", chrome.runtime.lastError.message); });
        // console.log("USPI: Context menu creation attempted.");
    });
}

// --- URL Checking & Script Injection ---
async function checkAndInject(tabId, url) {
    const injectionCheckKey = `inject_check_${tabId}`;
    try { // Wrap storage access in try-catch
        const lastCheckData = await chrome.storage.local.get(injectionCheckKey);
        const lastCheck = lastCheckData[injectionCheckKey];
        const now = Date.now();
        if (lastCheck && (now - lastCheck < 700)) { // Increased debounce slightly
            return;
        }
        await chrome.storage.local.set({ [injectionCheckKey]: now });
    } catch (e) { console.warn("USPI: Debounce storage error", e); }


    if (!url || !url.startsWith('http')) { return; }
    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const allowedUrls = data[STORAGE_KEY];
        if (!Array.isArray(allowedUrls)) { console.error("USPI: Allowed URLs not an array"); return; }
        const urlMatches = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && url.startsWith(baseUrl));

        if (urlMatches) {
            // console.log(`USPI: Injecting scripts for matched URL: ${url}`);
            try {
                await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['listener.js'] });
            } catch (err) {
                if (!err.message?.includes("No tab with id") && !err.message?.includes("Cannot access") && !err.message?.includes("Could not establish connection")) console.warn(`USPI: Listener injection failed:`, err?.message);
            }
            try {
                 await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
            } catch(err) {
                 if (!err.message?.includes("No tab with id") && !err.message?.includes("Cannot access") && !err.message?.includes("Could not establish connection")) console.warn(`USPI: Content injection failed:`, err?.message);
            }
        }
    } catch (error) {
        console.error("USPI: Error during checkAndInject:", error);
    }
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Inject scripts when tab is completely loaded and has a valid http/https URL.
    if (tab.url && tab.url.startsWith('http') && tab.status === 'complete') {
        // Ensure changeInfo also indicates completion to avoid multiple triggers for same 'complete' state.
        if (changeInfo.status === 'complete') {
             // console.log(`USPI: Tab ${tabId} fully complete. Triggering check/inject.`);
             checkAndInject(tabId, tab.url);
        }
    }
});


// --- Context Menu Click Handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID_ADD_TO_SEQUENCE) return;
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http')) { console.warn("USPI: Context menu on invalid tab."); return; }

    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const allowedUrls = data[STORAGE_KEY] || [];
        const currentUrlAllowed = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && tab.url.startsWith(baseUrl));
        if (!currentUrlAllowed) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: [`Injector Error:\nThis site (${new URL(tab.url).hostname}) is not in the allowlist. Add it via the popup first.`] }).catch(err => console.warn("USPI: Alert fail:", err));
            return;
        }
    } catch (error) { console.error("USPI: Error checking allowlist:", error); return; }

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getElementIdentifier,
        injectImmediately: true // Attempt to run sooner
    })
    .then(async (results) => {
        if (chrome.runtime.lastError || !results || results.length === 0 || typeof results[0]?.result === 'undefined') {
            console.error("USPI: Failed to get element identifier from page.", chrome.runtime.lastError);
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nCould not identify the clicked element on the page."] }).catch(err => console.warn(err));
            return;
        }
        const identifierInfo = results[0].result;
        if (!identifierInfo || !identifierInfo.identifier) {
            console.log("USPI: Element identification returned null or invalid identifier part.");
            chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nElement identification failed (no stable identifier found)."] }).catch(err => console.warn(err));
            return;
        }

        let suggestedActionType = 'click';
        let stepValue = 'click';

        if (identifierInfo.elementType && ['INPUT', 'TEXTAREA', 'SELECT'].includes(identifierInfo.elementType.toUpperCase())) {
            suggestedActionType = 'inject';
            stepValue = (identifierInfo.elementType.toUpperCase() === 'SELECT') ? '' : PLACEHOLDER_VALUE;
        }

        const newStep = {
            fullIdentifier: identifierInfo.type === 'id' ? identifierInfo.identifier : `css:${identifierInfo.identifier}`,
            identifier: identifierInfo.identifier,
            identifierType: identifierInfo.type,
            elementType: identifierInfo.elementType || 'UNKNOWN',
            actionType: suggestedActionType,
            value: stepValue,
            description: identifierInfo.description || (identifierInfo.type === 'id' ? `#${identifierInfo.identifier}`: identifierInfo.identifier)
        };

        const tempStorageKey = 'uspi_new_step_for_tab_' + tab.id;
        await chrome.storage.local.set({ [tempStorageKey]: { step: newStep, timestamp: Date.now() } });

        chrome.action.openPopup({}, (popupWindow) => {
            if (chrome.runtime.lastError) { console.error("USPI: Error opening popup:", chrome.runtime.lastError.message); }
        });
    })
    .catch(err => { console.error("USPI: Error in context menu executeScript chain:", err); });
});


// --- Message Listener from Popup ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "buildAndReload") {
        if (!request.tabId || !request.baseUrl || !Array.isArray(request.sequence)) {
            console.error("USPI: Invalid buildAndReload request:", request);
            sendResponse({ status: "error", message: "Invalid request data." });
            return true;
        }

        const sequence = request.sequence;
        let paramsArray = [];

        sequence.forEach(step => {
            let key = step.fullIdentifier;
            if (step.command === 'wait') key = 'wait';
            if (step.command === 'pressEnter') key = 'pressEnter';
            paramsArray.push(`${encodeURIComponent(key)}=${encodeURIComponent(step.value)}`);
        });

        const queryString = paramsArray.join('&');
        let newUrl = request.baseUrl; // Base URL (path included, no query/hash from original)

        if (queryString) {
            newUrl = `${newUrl}${newUrl.includes('?') ? '&' : '?'}${queryString}`;
        }

        console.log(`USPI: Reloading tab ${request.tabId} from popup sequence: ${newUrl}`);
        chrome.tabs.update(request.tabId, { url: newUrl }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            } else {
                sendResponse({ status: "success" });
            }
        });
        return true;

    } else if (request.action === "getSelectOptions") {
        if (!request.tabId || !request.selectIdentifier) {
            sendResponse({ status: "error", message: "Missing data for getSelectOptions" });
            return true;
        }
        chrome.scripting.executeScript({
            target: { tabId: request.tabId },
            func: fetchOptionsFromSelectInPage, // Renamed for clarity
            args: [request.selectIdentifier]
        })
        .then(results => {
            if (chrome.runtime.lastError || !results || !results[0]) {
                sendResponse({ status: "error", options: [], message: "Failed to fetch options." });
            } else {
                sendResponse({ status: "success", options: results[0].result });
            }
        })
        .catch(err => { sendResponse({ status: "error", options: [], message: "Exception." }); });
        return true;
    }
    return false;
});

// --- Injected Function to fetch options from a <select> element on the page ---
function fetchOptionsFromSelectInPage(selectIdentifier) {
    let selectElement = null;
    const isCssSelector = selectIdentifier.startsWith("css:");
    const lookupValue = isCssSelector ? selectIdentifier.substring(4) : selectIdentifier;

    try {
        selectElement = isCssSelector ? document.querySelector(lookupValue) : document.getElementById(lookupValue);
    } catch (e) {
        console.warn("USPI: Invalid selector for fetchOptions", lookupValue, e);
        return [];
    }

    if (selectElement && selectElement.tagName === 'SELECT') {
        return Array.from(selectElement.options).map(opt => ({
            text: opt.text,
            value: opt.value,
            selected: opt.selected
        }));
    }
    console.warn("USPI: fetchOptions - Element not found or not a SELECT:", selectIdentifier);
    return [];
}


// --- Injected Function to Get Identifier (Returns type, identifier, description, elementType) ---
function getElementIdentifier() {
    const clickedElement = window.lastRightClickedElement; if (!clickedElement) { return null; }
    const targetSelector = 'input, textarea, button, a, [role="button"], [contenteditable="true"], select';
    const element = clickedElement.closest(targetSelector); if (!element) { /* console.log("USPI Identifier: No relevant element near click."); */ return null; }

    let elDescription = element.tagName.toLowerCase();
    const elId = element.id;
    const elAriaLabel = element.getAttribute('aria-label');
    const elName = element.getAttribute('name');
    const elPlaceholder = element.getAttribute('placeholder');

    if (elId) elDescription += `#${elId}`;
    else if (elAriaLabel) elDescription += `[aria-label="${elAriaLabel.substring(0,20)}..."]`;
    else if (elName) elDescription += `[name="${elName}"]`;
    else if (elPlaceholder) elDescription += `[placeholder="${elPlaceholder.substring(0,20)}..."]`;
    else if (element.classList && element.classList.length > 0) elDescription += `.${Array.from(element.classList).filter(c => c.length < 20).slice(0,2).join('.')}`;


    function checkAttributeUniqueness(el, attrName, attrValue) {
         if (!attrValue || attrValue.trim().length === 0) return null;
         let escapedValue = attrValue; let quoteChar = '"';
         if (attrValue.includes('"') && attrValue.includes("'")) { escapedValue = attrValue.replace(/"/g, '\\"'); }
         else if (attrValue.includes('"')) { quoteChar = "'"; }
         const selector = `[${attrName}=${quoteChar}${escapedValue}${quoteChar}]`;
         try { const matches = document.querySelectorAll(selector); if (matches.length === 1 && matches[0] === el) { /* console.log(`USPI Identifier: Unique [${attrName}]`); */ return { type: 'css', identifier: selector, description: elDescription, elementType: el.tagName }; } }
         catch (e) { console.warn(`USPI Identifier: Error testing [${attrName}] selector`, e); } return null;
    }
    let result = null;

    result = checkAttributeUniqueness(element, 'aria-label', elAriaLabel); if (result) return result;
    if (elId) {
        const commonShortIds = ['q', 's', 'id', 'key', 'kw', 'query', 'search', 'input', 'text', 'button', 'submit', 'username', 'password'];
        const looksShortAndMaybeBad = (elId.length <= 2 && !commonShortIds.includes(elId.toLowerCase()));
        const looksGenerated = /([a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{12,})|(-{2,}\d+)|(_ngcontent-)|(ember\d+)|(^[a-zA-Z]{1,2}\d+$)/i.test(elId);
        const looksLikeGuidOrLong = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(elId) || elId.length >= 40;
        if (elId.length > 0 && !looksShortAndMaybeBad && !looksGenerated && !looksLikeGuidOrLong) {
             try { const idSelector = `#${elId.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`; const matches = document.querySelectorAll(idSelector); if (matches.length === 1 && matches[0] === element) { /* console.log("USPI Identifier: Found ID:", elId); */ return { type: 'id', identifier: elId, description: elDescription, elementType: element.tagName }; } }
             catch(e) { console.warn(`USPI Identifier: Error ID selector "#${elId}":`, e); }
        }
    }
    result = checkAttributeUniqueness(element, 'data-testid', element.getAttribute('data-testid')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-cy', element.getAttribute('data-cy')); if (result) return result; result = checkAttributeUniqueness(element, 'data-cypress', element.getAttribute('data-cypress')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-qa', element.getAttribute('data-qa')); if (result) return result; result = checkAttributeUniqueness(element, 'data-qa-id', element.getAttribute('data-qa-id')); if (result) return result;
    const tagName = element.tagName.toUpperCase(); if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName)) { result = checkAttributeUniqueness(element, 'name', elName); if (result) return result; }
    if (['INPUT', 'TEXTAREA'].includes(tagName)) { result = checkAttributeUniqueness(element, 'placeholder', elPlaceholder); if (result) return result; }
    result = checkAttributeUniqueness(element, 'data-component', element.getAttribute('data-component')); if (result) return result; result = checkAttributeUniqueness(element, 'data-element', element.getAttribute('data-element')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-target', element.getAttribute('data-target')); if (result) return result; result = checkAttributeUniqueness(element, 'data-action', element.getAttribute('data-action')); if (result) return result;
    if (element.classList && element.classList.length > 0) {
        const stableClasses = Array.from(element.classList).filter(cls => !!cls && cls.length > 1 && !cls.startsWith('_') && !/\d/.test(cls) && !cls.includes(':'));
        if (stableClasses.length > 0) {
             const selector = '.' + stableClasses.map(cls => cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&')).join('.');
             try { const matches = document.querySelectorAll(selector); if (matches.length === 1 && matches[0] === element) { /* console.log("USPI Identifier: Unique class selector"); */ return { type: 'css', identifier: selector, description: elDescription, elementType: element.tagName }; } }
             catch (e) { /* Ignore */ }
        }
    }
    console.log("USPI Identifier: Failed identification, returning generic description for element:", element);
    return { type: 'css', identifier: 'selector_needed_manually', description: elDescription, elementType: element.tagName };
}