// popup.js V2 - Add Current Site Button

const STORAGE_KEY = 'allowedBaseUrls';
const urlInput = document.getElementById('new-url-input');
const addButton = document.getElementById('add-url-button');
const addCurrentSiteButton = document.getElementById('add-current-site-button');
const urlListElement = document.getElementById('url-list');
const statusMessageElement = document.getElementById('status-message');

// --- Helper Functions ---

function displayStatus(message, isError = false, duration = 3000) {
    statusMessageElement.textContent = message;
    statusMessageElement.className = isError ? 'error' : 'success';
    if (duration > 0) {
        // Clear message after duration
        setTimeout(() => {
            if (statusMessageElement.textContent === message) { // Avoid clearing newer messages
                statusMessageElement.textContent = '';
                statusMessageElement.className = '';
            }
        }, duration);
    }
}

function renderUrlList(urls) {
    urlListElement.innerHTML = ''; // Clear current list

    if (!urls || urls.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = 'No URLs added yet.';
        listItem.style.textAlign = 'center';
        listItem.style.color = '#777';
        urlListElement.appendChild(listItem);
        return;
    }

    urls.forEach(url => {
        const listItem = document.createElement('li');

        const urlTextSpan = document.createElement('span');
        urlTextSpan.className = 'url-text';
        urlTextSpan.textContent = url;
        urlTextSpan.title = url; // Show full URL on hover if needed

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-btn';
        removeButton.dataset.url = url; // Store URL in data attribute

        listItem.appendChild(urlTextSpan);
        listItem.appendChild(removeButton);
        urlListElement.appendChild(listItem);
    });
}

async function loadUrls() {
    try {
        // Use chrome.storage.sync.get with a default value
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        const urls = data[STORAGE_KEY];
        // Ensure it's an array before rendering
        if (Array.isArray(urls)) {
             renderUrlList(urls);
        } else {
             console.error("Stored URLs are not an array:", urls);
             renderUrlList([]); // Render empty list if data is corrupt
             // Optionally reset storage
             // await chrome.storage.sync.set({ [STORAGE_KEY]: [] });
        }
    } catch (error) {
        console.error("Error loading URLs:", error);
        displayStatus("Error loading URL list.", true, 0); // Keep error shown
        renderUrlList([]); // Show empty state on error
    }
}

async function removeUrl(urlToRemove) {
    if (!urlToRemove) return;
    displayStatus('', false); // Clear previous status

    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        let urls = data[STORAGE_KEY];

        if (!Array.isArray(urls)) {
            console.warn("Attempting to remove from non-array storage, resetting.");
            urls = [];
        }

        const initialLength = urls.length;
        const updatedUrls = urls.filter(url => url !== urlToRemove);

        if (updatedUrls.length < initialLength) {
            await chrome.storage.sync.set({ [STORAGE_KEY]: updatedUrls });
            renderUrlList(updatedUrls);
            displayStatus(`URL "${urlToRemove}" removed.`, false);
        } else {
             console.warn(`URL "${urlToRemove}" not found in the list.`);
             // Optionally display a status?
        }

    } catch (error) {
        console.error("Error removing URL:", error);
        displayStatus("Error removing URL.", true);
    }
}


// --- Unified addUrl function ---
async function addUrl(urlToAdd) {
    displayStatus('', false); // Clear previous status
    let newUrl = urlToAdd.trim();
    if (!newUrl) {
        displayStatus("URL cannot be empty.", true);
        return;
    }

    // Basic validation: Ensure it starts with http:// or https://
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        // Try to prepend https:// as a common correction
        newUrl = 'https://' + newUrl;
        if (!newUrl.includes('.')) { // Very basic check if it looks like a domain
             displayStatus("Invalid URL format. Must start with http(s):// and contain a domain.", true);
             return;
        }
         displayStatus(`Prepended "https://". Add again if correct: ${newUrl}`, false, 5000);
         urlInput.value = newUrl; // Update manual input if it was used
         return; // Let user confirm the prepended version
    }

    // Normalize URL: ensure trailing slash for consistency
    try {
        const urlObject = new URL(newUrl); // Use URL constructor for better parsing/validation
        newUrl = `${urlObject.origin}${urlObject.pathname}`; // Keep path
        if (!newUrl.endsWith('/')) {
            newUrl += '/';
        }
        // Optionally handle search/hash? For base URLs, usually best to strip them.
        // newUrl = `${urlObject.origin}/`; // Simpler: just use origin

    } catch (e) {
         displayStatus("Invalid URL format.", true);
         return;
    }


    try {
        const data = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
        let urls = data[STORAGE_KEY];
        if (!Array.isArray(urls)) { // Ensure it's an array
             console.warn("Stored URLs were not an array, resetting.");
             urls = [];
        }

        if (urls.includes(newUrl)) {
            displayStatus(`URL "${newUrl}" is already in the list.`, true);
            return;
        }

        urls.push(newUrl);
        urls.sort(); // Keep the list sorted alphabetically

        await chrome.storage.sync.set({ [STORAGE_KEY]: urls });
        renderUrlList(urls); // Update the displayed list
        urlInput.value = ''; // Clear manual input field after success
        displayStatus(`URL "${newUrl}" added successfully!`, false);

    } catch (error) {
        console.error("Error adding URL:", error);
        displayStatus("Error saving URL.", true);
    }
}

// --- Handler for Add Current Site Button ---
async function handleAddCurrentSite() {
    displayStatus('', false); // Clear previous status
    try {
        // Find the active tab in the current window
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tabs && tabs.length > 0) {
            const currentTab = tabs[0];
            if (currentTab.url && currentTab.url.startsWith('http')) {
                // Extract base URL (origin + trailing slash) for simplicity
                const urlObject = new URL(currentTab.url);
                const baseUrl = `${urlObject.origin}/`;
                addUrl(baseUrl); // Call the common addUrl function
            } else {
                displayStatus("Cannot add current site: Invalid URL (e.g., chrome://, file://).", true);
            }
        } else {
            console.warn("Could not find active tab in current window.");
            displayStatus("Cannot get current tab information.", true);
        }
    } catch (error) {
        console.error("Error getting current tab:", error);
        displayStatus("Error getting current tab URL.", true);
    }
}


// --- Event Listeners ---

// Load URLs when popup opens
document.addEventListener('DOMContentLoaded', loadUrls);

// Handle Manual Add button click
addButton.addEventListener('click', () => {
    addUrl(urlInput.value); // Pass the input value to addUrl
});

// Handle Enter key in manual input field
urlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        addUrl(urlInput.value); // Pass the input value to addUrl
    }
});

// Handle Add Current Site button click
addCurrentSiteButton.addEventListener('click', handleAddCurrentSite);

// Handle Remove button clicks (using event delegation on the list)
urlListElement.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-btn')) {
        const urlToRemove = event.target.dataset.url;
        removeUrl(urlToRemove);
    }
});