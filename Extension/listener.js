// listener.js
if (!window.uspiListenerAttached) { // Prevent attaching multiple times
    window.uspiListenerAttached = true;
    document.addEventListener('contextmenu', (event) => {
        // Store the element that was actually right-clicked
        window.lastRightClickedElement = event.target;
        // Optional: Log only when debugging
        // console.log("USPI Listener: Captured element:", window.lastRightClickedElement);
    }, true); // Use capture phase
    // console.log("USPI Listener Attached."); // Optional: Log only when debugging
}