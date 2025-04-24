// content.js

console.log("Universal Search Parameter Injector: Content script loaded.");

// Function to inject value into an element
function injectValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        console.log(`Universal Search Parameter Injector: Found element with ID "${elementId}". Injecting value "${value}".`);
        try {
            // Primarily target form elements with a 'value' property
            if ('value' in element) {
                element.value = value;
                // Trigger events to simulate user input for potentially reactive frameworks/listeners
                element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                return true; // Injection successful
            } else if (element.isContentEditable) {
                 // Handle contentEditable elements as a fallback
                element.textContent = value;
                element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                 return true; // Injection successful
            } else {
                console.warn(`Universal Search Parameter Injector: Element with ID "${elementId}" found, but it's not an input, textarea, select, or contentEditable element. Cannot reliably inject value.`);
                return false; // Element found but not injectable type
            }
        } catch (error) {
            console.error(`Universal Search Parameter Injector: Error injecting value into element ID "${elementId}":`, error);
            return false; // Injection failed due to error
        }
    }
    return false; // Element not found yet
}

// Function to process URL parameters and setup observers if needed
function processUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramsToInject = new Map(); // Use a Map to store {id: value} pairs

    // Collect all URL parameters as potential injections
    for (const [key, value] of urlParams.entries()) {
        // Basic validation: ensure key looks like a plausible ID (e.g., not empty)
        // You could add more sophisticated filtering here if needed (e.g., require a prefix like 'inject_')
        if (key && key.trim() !== '') {
             paramsToInject.set(key.trim(), value);
        }
    }

    if (paramsToInject.size === 0) {
        // console.log("Universal Search Parameter Injector: No relevant URL parameters found.");
        return; // No work to do
    }

    console.log("Universal Search Parameter Injector: Parameters to inject:", Object.fromEntries(paramsToInject));

    const pendingInjections = new Map(paramsToInject); // Copy map for tracking pending items

    // --- Initial Check ---
    // Try to inject immediately for elements already present
    for (const [elementId, value] of pendingInjections.entries()) {
        if (injectValue(elementId, value)) {
            pendingInjections.delete(elementId); // Remove successfully injected items
        }
    }

    // --- Handle Delayed Loading with MutationObserver ---
    if (pendingInjections.size > 0) {
        console.log("Universal Search Parameter Injector: Some elements not found initially, setting up MutationObserver for:", Object.fromEntries(pendingInjections));

        const observer = new MutationObserver((mutationsList, obs) => {
            // Check if any pending elements are now available
            for (const [elementId, value] of pendingInjections.entries()) {
                if (document.getElementById(elementId)) { // Check existence without trying to inject yet
                     console.log(`Universal Search Parameter Injector: Observed element with ID "${elementId}" appeared.`);
                     if (injectValue(elementId, value)) {
                         pendingInjections.delete(elementId); // Remove from pending list
                     } else {
                         // Injection failed even though element exists (e.g., wrong type, error)
                         console.warn(`Universal Search Parameter Injector: Failed to inject into observed element "${elementId}" after it appeared.`);
                         pendingInjections.delete(elementId); // Stop trying for this one
                     }
                }
            }

            // If all pending injections are done, disconnect the observer
            if (pendingInjections.size === 0) {
                console.log("Universal Search Parameter Injector: All pending injections complete. Disconnecting observer.");
                obs.disconnect();
            }
        });

        // Start observing the document body for added nodes
        observer.observe(document.body || document.documentElement, {
            childList: true, // Watch for direct children changes
            subtree: true    // Watch for all descendants
        });

        // Optional: Set a timeout to disconnect the observer eventually
        // to prevent it running forever on very dynamic pages or if IDs never appear.
        const OBSERVER_TIMEOUT = 15000; // 15 seconds
        setTimeout(() => {
            if (observer && pendingInjections.size > 0) {
                console.warn(`Universal Search Parameter Injector: Observer timed out after ${OBSERVER_TIMEOUT / 1000}s. Disconnecting. Still pending:`, Object.fromEntries(pendingInjections));
                observer.disconnect();
            } else if (observer && pendingInjections.size === 0) {
                 // Already disconnected by success condition, do nothing.
            }
        }, OBSERVER_TIMEOUT);
    } else {
         console.log("Universal Search Parameter Injector: All injections completed on initial check.");
    }
}

// --- Main Execution ---
// Use a simple check to prevent running multiple times if script gets injected weirdly
if (!window.universalSearchParameterInjectorRan) {
    window.universalSearchParameterInjectorRan = true;
    // DOM is ready (document_idle), run the main logic.
    // Use requestAnimationFrame to ensure the very first paint cycle is done,
    // giving dynamically added elements slightly more chance to exist.
    requestAnimationFrame(processUrlParameters);

    // Alternatively, for SPAs that change URL without full page reload,
    // you might need to listen to history changes. This is more complex
    // and not explicitly required by the initial PRD. Example:
    // window.addEventListener('popstate', processUrlParameters);
    // new MutationObserver((mutations) => {
    //    if (mutations.some(m => m.type === 'childList' && m.target === document.head)) {
    //       // Potentially detect title changes or other SPA navigation clues
    //    }
    // }).observe(document.head, { childList: true, subtree: true });
}