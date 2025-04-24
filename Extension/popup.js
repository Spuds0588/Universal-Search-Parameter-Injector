// popup.js

const STORAGE_KEY = 'allowedBaseUrls';
const urlInput = document.getElementById('new-url-input');
const addButton = document.getElementById('add-url-button');
const urlListElement = document.getElementById('url-list');
const statusMessageElement = document.getElementById('status-message');

// --- Helper Functions ---

function displayStatus(message, isError = false) {
    statusMessageElement.textContent = message;
    statusMessageElement.className = isError ? 'error' : 'success';
    // Clear message after a few seconds
    setTimeout(() => {
        statusMessageElement.textContent = '';
        statusMessageElement.className = '';
    }, 3000);
}

function renderUrlList(urls) {
    urlListElement.innerHTML = ''; // Clear current list

    if (!urls || urls.length === 0) {
        urlListElement.innerHTML = '<li>No URLs added yet.</li>';
        return;
    }

    urls.forEach(url => {
        const listItem = document.createElement('li');

        const urlTextSpan = document.createElement('span');
        urlTextSpan.className = 'url-text';
        urlTextSpan.textContent = url;

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-btn';
        removeButton.dataset.url = url; // Store URL in data attribute for easy removal

        listItem.appendChild(urlTextSpan);
        listItem.appendChild(removeButton);
        urlListElement.appendChild(listItem);
    });
}

async function loadUrls() {
    try {
        const data = await chrome.storage.sync.get(STORAGE_KEY);
        const urls = data[STORAGE_KEY] || [];
        renderUrlList(urls);
    } catch (error) {
        console.error("Error loading URLs:", error);
        displayStatus("Error loading URL list.", true);
        renderUrlList([]); // Show empty state on error
    }
}

async function addUrl() {
    let newUrl = urlInput.value.trim();
    if (!newUrl) {
        displayStatus("Please enter a URL.", true);
        return;
    }

    // Basic validation: Ensure it starts with http:// or https://
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        displayStatus("URL must start with http:// or https://", true);
        // Optionally, try to prepend https://
        // newUrl = 'https://' + newUrl;
        // displayStatus("Prepended https://. Click Add again if correct.", true);
        // urlInput.value = newUrl;
        return;
    }

    // Optional: Normalize URL (e.g., add trailing slash if missing?)
     if (!newUrl.endsWith('/')) {
         newUrl += '/';
         // urlInput.value = newUrl; // Update input visually too
     }


    try {
        const data = await chrome.storage.sync.get(STORAGE_KEY);
        let urls = data[STORAGE_KEY] || [];

        if (urls.includes(newUrl)) {
            displayStatus("This URL is already in the list.", true);
            return;
        }

        urls.push(newUrl);
        urls.sort(); // Keep the list sorted

        await chrome.storage.sync.set({ [STORAGE_KEY]: urls });
        renderUrlList(urls);
        urlInput.value = ''; // Clear input field
        displayStatus("URL added successfully!", false);

    } catch (error) {
        console.error("Error adding URL:", error);
        displayStatus("Error saving URL.", true);
    }
}

async function removeUrl(urlToRemove) {
    if (!urlToRemove) return;

    try {
        const data = await chrome.storage.sync.get(STORAGE_KEY);
        let urls = data[STORAGE_KEY] || [];

        const updatedUrls = urls.filter(url => url !== urlToRemove);

        await chrome.storage.sync.set({ [STORAGE_KEY]: updatedUrls });
        renderUrlList(updatedUrls);
        displayStatus("URL removed.", false);

    } catch (error) {
        console.error("Error removing URL:", error);
        displayStatus("Error removing URL.", true);
    }
}


// --- Event Listeners ---

// Load URLs when popup opens
document.addEventListener('DOMContentLoaded', loadUrls);

// Handle Add button click
addButton.addEventListener('click', addUrl);

// Handle Enter key in input field
urlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        addUrl();
    }
});

// Handle Remove button clicks (using event delegation)
urlListElement.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-btn')) {
        const urlToRemove = event.target.dataset.url;
        removeUrl(urlToRemove);
    }
});