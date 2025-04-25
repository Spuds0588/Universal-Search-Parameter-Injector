// content.js V3.4 - Use 'pressEnter=true' syntax

// --- Constants ---
const CLICK_ACTION_VALUE = 'click';
const WAIT_TIMEOUT_MS = 7000;
const CSS_SELECTOR_PREFIX = "css:";
const WAIT_PARAM_KEY = "wait";
const PRESS_ENTER_PARAM_KEY = "pressenter"; // Use lowercase for key matching

// --- Helper: Wait for an element/selector (No changes) ---
function waitForTarget(targetSpecifier, timeout) { /* ... no changes ... */
    return new Promise((resolve, reject) => {
        let element = null;
        let isCssSelector = targetSpecifier.startsWith(CSS_SELECTOR_PREFIX);
        let lookupValue = isCssSelector ? targetSpecifier.substring(CSS_SELECTOR_PREFIX.length) : targetSpecifier;
        const findElement = () => { try { return isCssSelector ? document.querySelector(lookupValue) : document.getElementById(lookupValue); } catch (e) { console.warn(`USPI waitForTarget Error:`, e); return null; } };
        element = findElement();
        if (element) { resolve(element); return; }
        let observer;
        let timeoutId;
        const cleanUp = () => { if (observer) observer.disconnect(); if (timeoutId) clearTimeout(timeoutId); };
        observer = new MutationObserver(() => { element = findElement(); if (element) { cleanUp(); resolve(element); } });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
        timeoutId = setTimeout(() => { console.warn(`USPI: Timed out waiting for target "${lookupValue}" after ${timeout / 1000}s.`); cleanUp(); resolve(null); }, timeout);
    });
}

// --- Helper: Perform Injection (No changes) ---
function performInjection(element, value) { /* ... no changes ... */
    try {
        const targetId = element.id || (element.classList && element.classList.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
        if ('value' in element) { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); console.log(`USPI: Injected value "${value}" into element (${targetId}).`); return true; }
        else if (element.isContentEditable) { element.textContent = value; element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); console.log(`USPI: Injected value "${value}" into contentEditable element (${targetId}).`); return true; }
        else { console.warn(`USPI: Element (${targetId}) is not injectable.`); return false; }
    } catch (error) { console.error(`USPI: Error injecting value:`, error); return false; }
}

// --- Helper: Perform Click (No changes) ---
function performClick(element) { /* ... no changes ... */
     try {
         const targetId = element.id || (element.classList && element.classList.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
         const isClickable = element.click && ( element.tagName === 'BUTTON' || element.tagName === 'A' || (element.tagName === 'INPUT' && ['button', 'submit', 'reset', 'image'].includes(element.type?.toLowerCase())) || element.getAttribute('role') === 'button' );
         if (!isClickable) { console.warn(`USPI: Element (${targetId}) may not be clickable. Attempting anyway.`); }
         element.click(); console.log(`USPI: Clicked element (${targetId}).`); return true;
     } catch (error) { console.error(`USPI: Error clicking element:`, error); return false; }
}

// --- Helper to parse wait duration (No changes) ---
function parseWaitDuration(value) { /* ... no changes ... */
    if (!value) return 0;
    const match = value.match(/^(\d+)\s*(ms|s)$/i);
    if (match) { const num = parseInt(match[1], 10); const unit = match[2].toLowerCase(); if (!isNaN(num) && num > 0) { return (unit === 's') ? num * 1000 : num; } }
    console.warn(`USPI: Invalid wait format: "${value}".`); return 0;
}

// --- Helper to simulate Enter key press (No changes) ---
function simulateEnterKeyPress(targetElement) { /* ... no changes ... */
    if (!targetElement || typeof targetElement.dispatchEvent !== 'function') { console.warn("USPI: Cannot simulate Enter: Invalid target."); return; }
    console.log(`USPI: Simulating Enter key press on element:`, targetElement);
    const eventOptions = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    targetElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
    setTimeout(() => { targetElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions)); /* console.log(`USPI: Enter keyup dispatched.`); */ }, 50);
}


// --- Main Processing Function (MODIFIED for pressEnter=true) ---
async function processUrlParametersSequentially() {
    console.log("USPI: Starting sequential processing.");
    const urlParams = new URLSearchParams(window.location.search);
    let actionCount = 0;
    let lastInjectedInputElement = null; // Track the last input element interacted with

    for (const [key, value] of urlParams.entries()) {
        const currentKeyLower = key.toLowerCase(); // Use lowercase key for comparisons
        let currentActionProcessed = false; // Flag to ensure we continue correctly

        if (!key || key.trim() === '') {
            console.warn(`USPI: Skipping parameter with empty key.`);
            continue;
        }

        actionCount++;
        const currentActionLabel = `action #${actionCount}`; // For logging

        // --- Check for 'wait' parameter ---
        if (currentKeyLower === WAIT_PARAM_KEY) {
            const waitMs = parseWaitDuration(value);
            if (waitMs > 0) {
                console.log(`USPI: Processing ${currentActionLabel}: Waiting for ${waitMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                console.log(`USPI: Wait finished.`);
            } else {
                 console.warn(`USPI: Skipped invalid wait ${currentActionLabel}.`);
            }
            lastInjectedInputElement = null; // Reset last input after wait
            currentActionProcessed = true;
        }
        // --- << NEW: Check for 'pressEnter' key >> ---
        else if (currentKeyLower === PRESS_ENTER_PARAM_KEY) {
            // We don't need to check the value ('true'), just the presence of the key
             console.log(`USPI: Processing ${currentActionLabel}: Simulating Enter key press.`);
             if (lastInjectedInputElement && document.body.contains(lastInjectedInputElement)) {
                 simulateEnterKeyPress(lastInjectedInputElement);
             } else {
                 console.warn(`USPI: Cannot simulate Enter for ${currentActionLabel}: No previous target input element found or it's no longer in the DOM. Ensure an input was targeted immediately before the '${key}=...' parameter.`);
                 // Optional: Fallback to global dispatch?
                 // simulateEnterKeyPress(document.body);
             }
            lastInjectedInputElement = null; // Reset last input after attempt
            currentActionProcessed = true;
        }

        // If action was wait or pressEnter, continue to next parameter
        if (currentActionProcessed) {
            continue;
        }

        // --- Process regular element actions ---
        const targetSpecifier = key; // Original key used for targeting
        console.log(`USPI: Processing ${currentActionLabel}: Target="${targetSpecifier}", Value="${value}"`);
        lastInjectedInputElement = null; // Reset by default

        const element = await waitForTarget(targetSpecifier, WAIT_TIMEOUT_MS);

        if (element) {
            if (value.toLowerCase() === CLICK_ACTION_VALUE) {
                performClick(element);
            } else {
                const success = performInjection(element, value);
                // If injection succeeded on an input-like element, store it
                if (success && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)) {
                     lastInjectedInputElement = element;
                }
            }
        } else {
             console.warn(`USPI: Skipped ${currentActionLabel} for Target "${targetSpecifier}" (not found within timeout).`);
        }
    } // End loop

    if (actionCount > 0) {
         console.log(`USPI: Finished processing ${actionCount} actions.`);
    }
}

// --- Main Execution ---
// Use a unique flag for this version
if (!window.universalSearchParameterInjectorRan_v3_4) { // <-- UPDATE FLAG VERSION
    window.universalSearchParameterInjectorRan_v3_4 = true;
    requestAnimationFrame(() => {
        processUrlParametersSequentially().catch(error => {
             console.error("USPI: Unhandled error during sequential processing:", error);
        });
    });
}