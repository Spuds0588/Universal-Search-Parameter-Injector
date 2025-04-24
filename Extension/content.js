// content.js V3.1 - Listener removed, execution logic remains

// --- Constants ---
const CLICK_ACTION_VALUE = 'click';
const WAIT_TIMEOUT_MS = 7000; // Max time (ms) to wait for EACH element/selector to appear
const CSS_SELECTOR_PREFIX = "css:"; // Prefix used in URL parameters for CSS selectors

// --- Helper: Wait for an element/selector ---
function waitForTarget(targetSpecifier, timeout) {
    return new Promise((resolve, reject) => {
        let element = null;
        let isCssSelector = targetSpecifier.startsWith(CSS_SELECTOR_PREFIX);
        let lookupValue = isCssSelector ? targetSpecifier.substring(CSS_SELECTOR_PREFIX.length) : targetSpecifier;

        const findElement = () => {
             try {
                // Use querySelector for CSS, getElementById for ID
                return isCssSelector
                    ? document.querySelector(lookupValue)
                    : document.getElementById(lookupValue);
             } catch (e) {
                 // Log error if selector is invalid, but don't stop the promise chain
                 console.warn(`USPI waitForTarget: Error finding element/selector "${lookupValue}":`, e);
                 return null;
             }
        };

        // Check if already exists
        element = findElement();
        if (element) {
            // console.log(`USPI waitForTarget: Found target "${lookupValue}" immediately.`);
            resolve(element);
            return;
        }

        // Setup observer
        let observer;
        let timeoutId;
        const cleanUp = () => {
            if (observer) observer.disconnect();
            if (timeoutId) clearTimeout(timeoutId);
        };

        observer = new MutationObserver(() => {
            element = findElement();
            if (element) {
                // console.log(`USPI waitForTarget: Observed target "${lookupValue}" appeared.`);
                cleanUp();
                resolve(element);
            }
            // Keep observing if not found yet
        });

        // Start observing
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
        // console.log(`USPI waitForTarget: Target "${lookupValue}" not found. Observing...`);

        // Setup timeout
        timeoutId = setTimeout(() => {
             console.warn(`USPI: Timed out waiting for target "${lookupValue}" after ${timeout / 1000}s.`);
            cleanUp();
            resolve(null); // Resolve with null to indicate timeout
        }, timeout);
    });
}


// --- Helper: Perform Injection ---
function performInjection(element, value) {
    try {
        // Try to get a meaningful identifier for logging, even if ID is missing
        const targetId = element.id || (element.classList && element.classList.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
        if ('value' in element) { // Works for input, textarea, select
            element.value = value;
            // Trigger events for reactivity
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            console.log(`USPI: Injected value "${value}" into element (${targetId}).`);
            return true;
        } else if (element.isContentEditable) {
            element.textContent = value;
            // Trigger input event for contentEditable as well, some frameworks might listen
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
             console.log(`USPI: Injected value "${value}" into contentEditable element (${targetId}).`);
            return true;
        } else {
            console.warn(`USPI: Element (${targetId}) is not an input, textarea, select, or contentEditable. Cannot inject value.`);
            return false;
        }
    } catch (error) {
        console.error(`USPI: Error injecting value into element:`, error);
        return false;
    }
}

// --- Helper: Perform Click ---
function performClick(element) {
     try {
         const targetId = element.id || (element.classList && element.classList.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
         // Basic check if it's likely clickable
         const isClickable = element.click && (
            element.tagName === 'BUTTON' ||
            element.tagName === 'A' ||
            (element.tagName === 'INPUT' && ['button', 'submit', 'reset', 'image'].includes(element.type?.toLowerCase())) ||
            element.getAttribute('role') === 'button'
         );

         if (!isClickable) {
             console.warn(`USPI: Element (${targetId}) may not be directly clickable (Tag: ${element.tagName}, Type: ${element.type}). Attempting click anyway.`);
         }

         element.click();
         console.log(`USPI: Clicked element (${targetId}).`);
         return true;
     } catch (error) {
         console.error(`USPI: Error clicking element:`, error);
         return false;
     }
}


// --- Main Processing Function ---
async function processUrlParametersSequentially() {
    console.log("USPI: Starting sequential processing.");
    const urlParams = new URLSearchParams(window.location.search);
    let actionCount = 0;

    // URLSearchParams.entries() preserves the order of parameters
    for (const [targetSpecifier, value] of urlParams.entries()) {
        if (!targetSpecifier || targetSpecifier.trim() === '') {
            console.warn(`USPI: Skipping parameter with empty key.`);
            continue;
        }

        actionCount++;
        console.log(`USPI: Processing action #${actionCount}: Target="${targetSpecifier}", Value="${value}"`);

        // Wait for the element/selector to appear
        const element = await waitForTarget(targetSpecifier, WAIT_TIMEOUT_MS);

        if (element) {
            // Determine action based on value
            if (value.toLowerCase() === CLICK_ACTION_VALUE) {
                performClick(element);
            } else {
                performInjection(element, value);
            }
            // Optional small delay between actions if needed for UI updates
            // await new Promise(resolve => setTimeout(resolve, 50));
        } else {
             console.warn(`USPI: Skipped action #${actionCount} for Target "${targetSpecifier}" because it was not found within the timeout.`);
             // Continue to the next parameter even if one fails
        }
    }

    if (actionCount === 0) {
        // console.log("USPI: No relevant URL parameters found to process.");
    } else {
         console.log(`USPI: Finished processing ${actionCount} actions.`);
    }
}

// --- Main Execution ---
// Use a unique flag for this version to prevent multiple runs if injected unexpectedly
if (!window.universalSearchParameterInjectorRan_v3_1) {
    window.universalSearchParameterInjectorRan_v3_1 = true;

    // Use requestAnimationFrame to slightly delay execution until after first paint,
    // potentially helping with elements rendered very early by JS.
    requestAnimationFrame(() => {
        processUrlParametersSequentially().catch(error => {
             console.error("USPI: Unhandled error during sequential processing:", error);
        });
    });

} else {
     // console.log("USPI (v3.1): Already ran on this page load.");
}