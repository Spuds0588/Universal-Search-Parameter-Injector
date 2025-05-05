// content.js V3.5 - Manual Parameter Parsing & Fix Double Injection Error

// --- Main Execution Guard (WRAPPER) ---
// Use a unique flag and wrap the entire script execution
// to prevent re-declaration errors and redundant execution.
if (!window.universalSearchParameterInjectorRan_v3_5) {
    window.universalSearchParameterInjectorRan_v3_5 = true;

    // --- Constants (Now inside the guard) ---
    const CLICK_ACTION_VALUE = 'click';
    const WAIT_TIMEOUT_MS = 15000; // Keep increased timeout from previous step
    const CSS_SELECTOR_PREFIX = "css:";
    const WAIT_PARAM_KEY = "wait";
    const PRESS_ENTER_PARAM_KEY = "pressenter";

    // --- Helper: Wait for an element/selector (No changes needed from v3.4/3.5) ---
    function waitForTarget(targetSpecifier, timeout) {
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

    // --- Helper: Perform Injection (No changes needed) ---
    function performInjection(element, value) {
        try {
            const targetId = element.id || (element.classList && element.classList.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
            if ('value' in element) { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); console.log(`USPI: Injected value "${value}" into element (${targetId}).`); return true; }
            else if (element.isContentEditable) { element.textContent = value; element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); console.log(`USPI: Injected value "${value}" into contentEditable element (${targetId}).`); return true; }
            else { console.warn(`USPI: Element (${targetId}) is not injectable.`); return false; }
        } catch (error) { console.error(`USPI: Error injecting value:`, error); return false; }
    }

    // --- Helper: Perform Click (No changes needed) ---
    function performClick(element) {
         try {
             const targetId = element.id || (element.classList && element.classList.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
             const isClickable = element.click && ( element.tagName === 'BUTTON' || element.tagName === 'A' || (element.tagName === 'INPUT' && ['button', 'submit', 'reset', 'image'].includes(element.type?.toLowerCase())) || element.getAttribute('role') === 'button' );
             if (!isClickable) { console.warn(`USPI: Element (${targetId}) may not be clickable. Attempting anyway.`); }
             element.click(); console.log(`USPI: Clicked element (${targetId}).`); return true;
         } catch (error) { console.error(`USPI: Error clicking element:`, error); return false; }
    }

    // --- Helper to parse wait duration (No changes needed) ---
    function parseWaitDuration(value) {
        if (!value) return 0;
        const match = value.match(/^(\d+)\s*(ms|s)$/i);
        if (match) { const num = parseInt(match[1], 10); const unit = match[2].toLowerCase(); if (!isNaN(num) && num > 0) { return (unit === 's') ? num * 1000 : num; } }
        console.warn(`USPI: Invalid wait format: "${value}".`); return 0;
    }

    // --- Helper to simulate Enter key press (No changes needed) ---
    function simulateEnterKeyPress(targetElement) {
        if (!targetElement || typeof targetElement.dispatchEvent !== 'function') { console.warn("USPI: Cannot simulate Enter: Invalid target."); return; }
        console.log(`USPI: Simulating Enter key press on element:`, targetElement);
        const eventOptions = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
        targetElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
        setTimeout(() => { targetElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions)); /* console.log(`USPI: Enter keyup dispatched.`); */ }, 50);
    }

    // --- << NEW: Manual URL Parameter Parser >> ---
    // Handles keys potentially containing '=' by splitting only on '&' first,
    // then finding the first '=' in each segment.
    function parseQueryStringManually(queryString) {
        const params = [];
        if (!queryString || queryString.length <= 1) { // Should start with '?'
            return params;
        }
        // Remove leading '?' and split by '&'
        const pairs = queryString.substring(1).split('&');

        for (const pair of pairs) {
            let key, value = ''; // Default value is empty string
            const separatorIndex = pair.indexOf('=');

            if (separatorIndex === -1) {
                // Key only, no value (e.g., ?key)
                key = pair;
            } else {
                // Key and value present
                key = pair.substring(0, separatorIndex);
                value = pair.substring(separatorIndex + 1);
            }

            // Decode components AFTER splitting
            try {
                const decodedKey = decodeURIComponent(key.replace(/\+/g, ' ')); // Handle '+' for space
                const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
                 params.push([decodedKey, decodedValue]); // Store as [key, value] array
            } catch (e) {
                console.warn(`USPI: Error decoding parameter pair: "${pair}"`, e);
                // Optionally push raw values or skip
                // params.push([key, value]);
            }
        }
        return params;
    }


    // --- Main Processing Function (MODIFIED to use manual parser) ---
    async function processUrlParametersSequentially() {
        console.log("USPI: Starting sequential processing (manual parser).");
        // Use the manual parser instead of URLSearchParams
        const urlParams = parseQueryStringManually(window.location.search);
        console.log("USPI: Manually Parsed Params:", urlParams); // Log parsed params for debugging

        let actionCount = 0;
        let lastInjectedInputElement = null;

        // Iterate through the array of [key, value] pairs
        for (const [key, value] of urlParams) {
            const currentKeyLower = key.toLowerCase();
            let currentActionProcessed = false;

            // Skip if key is empty after decoding (shouldn't happen with manual parse, but safe)
            if (!key || key.trim() === '') {
                console.warn(`USPI: Skipping parameter with empty key.`);
                continue;
            }

            actionCount++;
            const currentActionLabel = `action #${actionCount}`;

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
                lastInjectedInputElement = null;
                currentActionProcessed = true;
            }
            // --- Check for 'pressEnter' key ---
            else if (currentKeyLower === PRESS_ENTER_PARAM_KEY) {
                 console.log(`USPI: Processing ${currentActionLabel}: Simulating Enter key press.`);
                 if (lastInjectedInputElement && document.body.contains(lastInjectedInputElement)) {
                     simulateEnterKeyPress(lastInjectedInputElement);
                 } else {
                     console.warn(`USPI: Cannot simulate Enter for ${currentActionLabel}: No previous target input element found or it's no longer in the DOM.`);
                 }
                lastInjectedInputElement = null;
                currentActionProcessed = true;
            }

            if (currentActionProcessed) {
                continue;
            }

            // --- Process regular element actions ---
            const targetSpecifier = key; // Use the correctly parsed key
            console.log(`USPI: Processing ${currentActionLabel}: Target="${targetSpecifier}", Value="${value}"`); // Log the CORRECT target/value
            lastInjectedInputElement = null;

            const element = await waitForTarget(targetSpecifier, WAIT_TIMEOUT_MS);

            if (element) {
                if (value.toLowerCase() === CLICK_ACTION_VALUE) {
                    performClick(element);
                } else {
                    const success = performInjection(element, value); // Inject the CORRECT value
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

    // --- Trigger Main Logic ---
    // Use requestAnimationFrame to ensure the DOM is visually ready
    requestAnimationFrame(() => {
        processUrlParametersSequentially().catch(error => {
             console.error("USPI: Unhandled error during sequential processing:", error);
        });
    });

} // --- End Main Execution Guard ---