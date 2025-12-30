// Bureaucracy Breaker - Background Service Worker
// Handles background tasks and messaging

console.log('[BACKGROUND] Service Worker initialized');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[BACKGROUND] Extension installed');
        // Open welcome page or perform initial setup
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    } else if (details.reason === 'update') {
        console.log('[BACKGROUND] Extension updated');
    }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BACKGROUND] Message received:', request);
    
    switch(request.action) {
        case 'checkHealth':
            checkAPIHealth()
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Will respond asynchronously
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// API health check function
async function checkAPIHealth() {
    const API_BASE = 'http://localhost:8004';
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`API returned ${response.status}`);
        }
    } catch (error) {
        throw new Error(`API health check failed: ${error.message}`);
    }
}

// Log extension startup
console.log('[BACKGROUND] Bureaucracy Breaker service worker ready');