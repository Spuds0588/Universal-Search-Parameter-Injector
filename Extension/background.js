// background.js V2.9 - Attempt earlier injection trigger

const STORAGE_KEY = 'allowedBaseUrls';
const CONTEXT_MENU_ID_INJECT = "uspiInjectValue";
const CONTEXT_MENU_ID_CLICK = "uspiClickElement";
const PLACEHOLDER_VALUE = "search-text-here";

// --- Initialization ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => { console.log("USPI: Initialized storage."); });
    } else if (details.reason === 'update') { console.log("USPI: Extension updated."); }
    setupContextMenus();
});
chrome.runtime.onStartup.addListener(() => { setupContextMenus(); });

function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) { console.warn("USPI: Error removing menus:", chrome.runtime.lastError.message); }
        chrome.contextMenus.create({ id: CONTEXT_MENU_ID_INJECT, title: "Add to Injector: Set Value (" + PLACEHOLDER_VALUE + ")", contexts: ["editable"] },
            () => { if (chrome.runtime.lastError) console.error("USPI: Error creating inject menu:", chrome.runtime.lastError.message); });
        chrome.contextMenus.create({ id: CONTEXT_MENU_ID_CLICK, title: "Add to Injector: Click Element", contexts: ["page", "frame", "link", "image", "video", "audio", "selection"] },
            () => { if (chrome.runtime.lastError) console.error("USPI: Error creating click menu:", chrome.runtime.lastError.message); });
    });
}

// --- URL Checking & Script Injection ---
async function checkAndInject(tabId, url) {
    // Debounce/prevent multiple rapid injections for the same tab/url if events fire quickly
    const injectionCheckKey = `inject_check_${tabId}`;
    const lastCheck = await chrome.storage.local.get(injectionCheckKey);
    const now = Date.now();
    // If checked within last 500ms, skip (adjust time as needed)
    if (lastCheck[injectionCheckKey] && (now - lastCheck[injectionCheckKey] < 500)) {
        // console.log(`USPI: Debouncing injection check for tab ${tabId}`);
        return;
    }
    await chrome.storage.local.set({ [injectionCheckKey]: now });


    if (!url || !url.startsWith('http')) { return; }
    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const allowedUrls = data[STORAGE_KEY];
        if (!Array.isArray(allowedUrls)) { console.error("USPI: Allowed URLs not an array"); return; }
        const urlMatches = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && url.startsWith(baseUrl));

        if (urlMatches) {
            console.log(`USPI: Injecting scripts for matched URL: ${url}`);
            // Inject listener first
            try {
                await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['listener.js'] });
            } catch (err) {
                if (!err.message.includes("No tab with id") && !err.message.includes("Cannot access") && !err.message.includes("Could not establish connection")) console.warn(`USPI: Listener injection failed:`, err?.message);
            }
            // Inject content script
            try {
                 await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
            } catch(err) {
                 if (!err.message.includes("No tab with id") && !err.message.includes("Cannot access") && !err.message.includes("Could not establish connection")) console.warn(`USPI: Content injection failed:`, err?.message);
            }
        }
    } catch (error) {
        console.error("USPI: Error during checkAndInject:", error);
    }
     // Clean up debounce flag after processing (or maybe on next navigation?)
     // setTimeout(() => chrome.storage.local.remove(injectionCheckKey), 2000); // Cleanup after 2s
}

// --- Listen for tab updates (MODIFIED TRIGGER LOGIC) ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Key conditions: URL exists, is http/s, and status is 'complete' OR 'loading' (to catch earlier state)
    if (tab.url && tab.url.startsWith('http')) {
        // Prioritize injecting if tab status is already 'complete', regardless of changeInfo
        if (tab.status === 'complete') {
            // console.log(`USPI: Tab ${tabId} update event, tab.status is 'complete'. Triggering check/inject.`);
            checkAndInject(tabId, tab.url);
        }
        // Also consider injecting if the change involves the status becoming 'loading',
        // as 'complete' might follow shortly or content might be usable then.
        // Avoid injecting repeatedly if only minor things change (e.g., favicon).
        // Let's primarily rely on tab.status === 'complete' check for simplicity/reliability.
        // else if (changeInfo.status === 'loading') {
        //    // Potentially check if scripts already injected? Might be too complex.
        // }
    }
});


// --- Context Menu Click Handler (No changes needed here) ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => { /* ... no changes ... */
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http')) { return; }
    try { /* Check Allowlist */
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] }); const allowedUrls = data[STORAGE_KEY]; if (!Array.isArray(allowedUrls)) { return; }
        const currentUrlAllowed = allowedUrls.some(baseUrl => typeof baseUrl === 'string' && tab.url.startsWith(baseUrl));
        if (!currentUrlAllowed) { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: [`Injector Error:\nSite not allowlisted.`] }).catch(err => console.warn(err)); return; }
    } catch (error) { console.error("USPI: Error checking allowlist:", error); return; }
    const actionType = (info.menuItemId === CONTEXT_MENU_ID_INJECT) ? 'inject' : 'click';
    chrome.scripting.executeScript({ target: { tabId: tab.id }, func: getElementIdentifier, injectImmediately: true })
    .then((results) => { /* Process results */
        if (chrome.runtime.lastError || !results || results.length === 0 || typeof results[0]?.result === 'undefined') { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nCould not get result."]}).catch(err=>console.warn(err)); return; }
        const identifierInfo = results[0].result;
        if (!identifierInfo || typeof identifierInfo !== 'object' || !identifierInfo.type || !identifierInfo.identifier) { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nElement ID failed."]}).catch(err=>console.warn(err)); return; }
        let paramKey = ''; if (identifierInfo.type === 'id') { paramKey = identifierInfo.identifier; } else if (identifierInfo.type === 'css') { paramKey = `css:${identifierInfo.identifier}`; } else { return; }
        const paramValue = (actionType === 'inject') ? PLACEHOLDER_VALUE : 'click';
        const encodedKey = encodeURIComponent(paramKey); const encodedValue = encodeURIComponent(paramValue); const newParam = `${encodedKey}=${encodedValue}`;
        const currentUrl = tab.url; let newUrl = ''; const urlParts = currentUrl.split('?'); const base = urlParts[0]; const existingQuery = urlParts[1] || '';
        if (existingQuery) { newUrl = `${base}?${existingQuery}&${newParam}`; } else { newUrl = `${base}?${newParam}`; }
        console.log(`USPI: Reloading tab ${tab.id} with new URL: ${newUrl}`);
        chrome.tabs.update(tab.id, { url: newUrl }, () => { if (chrome.runtime.lastError) { console.error("USPI: Error reloading tab:", chrome.runtime.lastError.message); chrome.tabs.get(tab.id, (et) => { if (et) { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nReload failed."]}).catch(err=>console.warn(err)); } }); } });
    })
    .catch(err => { console.error("USPI: Error during executeScript chain:", err); if (!err.message.includes("No tab with id")) { chrome.tabs.get(tab.id, (et) => { if (et) { chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (msg) => alert(msg), args: ["Injector Error:\nScript execution failed."]}).catch(errInner=>console.warn(errInner)); } }); } });
});


// --- Injected Function to Get Identifier (No changes needed here) ---
function getElementIdentifier() { /* ... no changes needed from v2.8 ... */
    const clickedElement = window.lastRightClickedElement; if (!clickedElement) { return null; }
    const targetSelector = 'input, textarea, button, a, [role="button"], [contenteditable="true"]'; const element = clickedElement.closest(targetSelector); if (!element) { return null; }
    function checkAttributeUniqueness(el, attrName, attrValue) { if (!attrValue || attrValue.trim().length === 0) return null; let escapedValue = attrValue; let quoteChar = '"'; if (attrValue.includes('"') && attrValue.includes("'")) { escapedValue = attrValue.replace(/"/g, '\\"'); } else if (attrValue.includes('"')) { quoteChar = "'"; } const selector = `[${attrName}=${quoteChar}${escapedValue}${quoteChar}]`; try { const matches = document.querySelectorAll(selector); if (matches.length === 1 && matches[0] === el) { console.log(`USPI Identifier: Found unique [${attrName}] selector:`, selector); return { type: 'css', identifier: selector }; } } catch (e) { console.warn(`USPI Identifier: Error testing [${attrName}] selector "${selector}":`, e); } return null; }
    let result = null; result = checkAttributeUniqueness(element, 'aria-label', element.getAttribute('aria-label')); if (result) return result;
    if (element.id) { const id = element.id; const looksGenerated = /([a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{4,}-[a-f0-9]{12,})|(-{2,}\d+)|(_ngcontent-)|(ember\d+)|(^[a-zA-Z]{1,2}\d+$)/i.test(id); const looksLikeGuidOrLong = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(id) || id.length >= 40; if (id.length > 0 && !looksGenerated && !looksLikeGuidOrLong) { try { const idSelector = `#${id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`; const matches = document.querySelectorAll(idSelector); if (matches.length === 1 && matches[0] === element) { console.log("USPI Identifier: Found stable & unique ID:", id); return { type: 'id', identifier: id }; } } catch(e) { console.warn(`USPI Identifier: Error testing ID selector "#${id}":`, e); } } }
    result = checkAttributeUniqueness(element, 'data-testid', element.getAttribute('data-testid')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-cy', element.getAttribute('data-cy')); if (result) return result; result = checkAttributeUniqueness(element, 'data-cypress', element.getAttribute('data-cypress')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-qa', element.getAttribute('data-qa')); if (result) return result; result = checkAttributeUniqueness(element, 'data-qa-id', element.getAttribute('data-qa-id')); if (result) return result;
    const tagName = element.tagName.toUpperCase(); if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName)) { result = checkAttributeUniqueness(element, 'name', element.getAttribute('name')); if (result) return result; }
    if (['INPUT', 'TEXTAREA'].includes(tagName)) { result = checkAttributeUniqueness(element, 'placeholder', element.getAttribute('placeholder')); if (result) return result; }
    result = checkAttributeUniqueness(element, 'data-component', element.getAttribute('data-component')); if (result) return result; result = checkAttributeUniqueness(element, 'data-element', element.getAttribute('data-element')); if (result) return result;
    result = checkAttributeUniqueness(element, 'data-target', element.getAttribute('data-target')); if (result) return result; result = checkAttributeUniqueness(element, 'data-action', element.getAttribute('data-action')); if (result) return result;
    if (element.classList && element.classList.length > 0) { const stableClasses = Array.from(element.classList).filter(cls => !!cls && cls.length > 1 && !cls.startsWith('_') && !/\d/.test(cls) && !cls.includes(':')); if (stableClasses.length > 0) { const selector = '.' + stableClasses.map(cls => cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&')).join('.'); try { const matches = document.querySelectorAll(selector); if (matches.length === 1 && matches[0] === element) { console.log("USPI Identifier: Found unique class selector:", selector); return { type: 'css', identifier: selector }; } } catch (e) { /* Ignore selector errors */ } } }
    console.log("USPI Identifier: Failed identification for element:", element); return null;
}

// --- REMOVED notifyUser function ---