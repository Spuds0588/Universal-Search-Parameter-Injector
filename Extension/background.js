// background.js

const STORAGE_KEY = 'allowedBaseUrls';

// Initialize storage on first install
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => {
            console.log("Universal Search Parameter Injector: Initialized allowed URLs storage.");
        });
    }
    // Could add migration logic here for updates if needed later
});

// Function to check URL and inject script
async function checkAndInject(tabId, url) {
    if (!url || !url.startsWith('http')) {
        return; // Ignore invalid URLs (e.g., chrome://, about:blank)
    }

    try {
        const data = await chrome.storage.sync.get(STORAGE_KEY);
        const allowedUrls = data[STORAGE_KEY] || [];

        const urlMatches = allowedUrls.some(baseUrl => url.startsWith(baseUrl));

        if (urlMatches) {
            console.log(`Universal Search Parameter Injector: URL ${url} matches allowed list. Injecting content script.`);
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            // Optional: Check results for errors, but content.js handles internal errors
             // const results = await ...
             // if (chrome.runtime.lastError) { ... } or check results array
        } else {
            // console.log(`Universal Search Parameter Injector: URL ${url} does not match allowed list.`);
        }
    } catch (error) {
        console.error("Universal Search Parameter Injector: Error accessing storage or injecting script:", error);
    }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Inject when page loading is complete and it has a URL
    // Using 'complete' status is generally reliable
    if (changeInfo.status === 'complete' && tab.url) {
        checkAndInject(tabId, tab.url);
    }
    // Note: 'complete' might fire multiple times for pages with frames.
    // The content.js script has an internal check (window.universalSearchParameterInjectorRan)
    // to prevent running its logic multiple times per page load.
});

// Optional: Listen for Web Navigation events (might be more precise for SPA navigations)
/*
chrome.webNavigation.onCompleted.addListener((details) => {
    // Ignore frames, only inject on the main page navigation completion
    if (details.frameId === 0 && details.url && details.url.startsWith('http')) {
        checkAndInject(details.tabId, details.url);
    }
}, { url: [{ schemes: ["http", "https"] }] }); // Filter to only http/https
*/