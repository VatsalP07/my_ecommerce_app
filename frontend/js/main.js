// frontend/ts/main.ts
export const API_BASE_URL = 'http://localhost:5001/api/v1'; // Your backend API URL
// --- Token Management ---
export function getToken() {
    // console.log(`[main.ts - getToken] Called on page: ${window.location.pathname}. Attempting to get 'authToken'.`);
    const token = localStorage.getItem('authToken');
    // console.log(`[main.ts - getToken] Value from localStorage for 'authToken':`, token);
    return token; // This should be the RAW token
}
export function setToken(receivedTokenValue) {
    // console.log('[main.ts - setToken] Attempting to set token. Received value:', receivedTokenValue);
    if (typeof receivedTokenValue === 'string' && receivedTokenValue.trim() !== '') {
        let tokenToStore = receivedTokenValue;
        if (receivedTokenValue.toLowerCase().startsWith('bearer ')) {
            tokenToStore = receivedTokenValue.substring(7).trim();
            // console.log('[main.ts - setToken] Removed "Bearer " prefix. Storing raw token:', tokenToStore);
        }
        if (tokenToStore === '') {
            // console.error('[main.ts - setToken] Token became empty after stripping "Bearer ", not storing.');
            return;
        }
        try {
            localStorage.setItem('authToken', tokenToStore);
            // const storedToken = localStorage.getItem('authToken');
            // console.log('[main.ts - setToken] Token supposedly SET. Value read back from localStorage:', storedToken);
            // if (tokenToStore !== storedToken) {
            //     console.error('[main.ts - setToken] CRITICAL MISMATCH! Token set was different from token read back!');
            // }
        }
        catch (e) {
            console.error('[main.ts - setToken] Error setting item in localStorage:', e);
        }
    }
    else {
        console.error('[main.ts - setToken] Invalid token received (empty or not a string). Token was:', receivedTokenValue);
    }
}
export function removeToken() {
    // console.log(`[main.ts - removeToken] Called on page: ${window.location.pathname}. Removing 'authToken'.`);
    localStorage.removeItem('authToken');
}
// --- Navigation and UI Updates ---
export function updateNav() {
    // console.log(`[main.ts - updateNav] Called on page: ${window.location.pathname}.`);
    const authLinksContainer = document.getElementById('auth-links');
    const token = getToken();
    // console.log(`[main.ts - updateNav] Current token from getToken():`, token);
    if (authLinksContainer) {
        if (token) {
            // console.log('[main.ts - updateNav] Token exists. Setting up "Profile/Logout" links.');
            authLinksContainer.innerHTML = `
                <a href="#">Profile (TODO)</a>
                <a href="#" id="logout-link">Logout</a>
            `;
            const logoutLink = document.getElementById('logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    // console.log('[main.ts - updateNav] Logout link clicked.');
                    removeToken();
                    alert('Logged out successfully!');
                    window.location.href = '/login.html';
                });
            }
        }
        else {
            // console.log('[main.ts - updateNav] Token MISSING or empty. Setting up "Login/Register" links.');
            authLinksContainer.innerHTML = `
                <a href="/login.html">Login</a>
                <a href="/register.html">Register</a>
            `;
        }
    }
    else {
        // console.warn(`[main.ts - updateNav] auth-links container not found on page: ${window.location.pathname}`);
    }
    updateCartCount();
}
export async function updateCartCount() {
    // console.log(`[main.ts - updateCartCount] Called on page: ${window.location.pathname}.`);
    const cartCountSpan = document.getElementById('cart-count');
    if (!cartCountSpan) {
        // console.warn(`[main.ts - updateCartCount] cart-count span not found on page: ${window.location.pathname}`);
        return;
    }
    const rawToken = getToken();
    // console.log(`[main.ts - updateCartCount] Raw token for cart fetch:`, rawToken);
    if (!rawToken) {
        // console.log('[main.ts - updateCartCount] No token, setting cart count to 0.');
        cartCountSpan.textContent = '0';
        return;
    }
    try {
        // console.log('[main.ts - updateCartCount] Fetching cart data...');
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${rawToken}` }
        });
        // console.log(`[main.ts - updateCartCount] /cart API response status: ${response.status}`);
        if (!response.ok) {
            if (response.status === 401) {
                // console.error('[main.ts - updateCartCount] /cart API call returned 401 UNAUTHORIZED. Removing token.');
                removeToken();
                updateNav();
            }
            else {
                // console.error(`[main.ts - updateCartCount] Failed to fetch cart for count. Status: ${response.status}`);
            }
            cartCountSpan.textContent = '0';
            return;
        }
        const cartData = await response.json();
        // console.log('[main.ts - updateCartCount] Cart data received:', cartData);
        if (cartData.data && typeof cartData.data.totalQuantity === 'number') {
            cartCountSpan.textContent = cartData.data.totalQuantity.toString();
        }
        else if (cartData.data && Array.isArray(cartData.data.items)) {
            const quantity = cartData.data.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            cartCountSpan.textContent = quantity.toString();
        }
        else {
            // console.warn('[main.ts - updateCartCount] Cart data received but format unexpected or items missing. Setting count to 0.');
            cartCountSpan.textContent = '0';
        }
    }
    catch (error) {
        // console.error('[main.ts - updateCartCount] Network or other error updating cart count:', error);
        cartCountSpan.textContent = '0';
    }
}
// --- Socket.IO Client Setup ---
// @ts-ignore - This tells TypeScript to ignore the 'io is not defined' error for the next line,
// as 'io' will be globally available from the CDN script.
const socket = io('http://localhost:5001'); // Your backend Socket.IO server URL
socket.on('connect', () => {
    console.log(`[Socket.IO Client - main.ts]: Connected to server! Socket ID: ${socket.id} on page: ${window.location.pathname}`);
    // Example: Send a message to server after connecting (optional)
    // socket.emit('clientMessage', { message: `Hello from frontend client on ${window.location.pathname}!` });
});
socket.on('disconnect', () => {
    console.log(`[Socket.IO Client - main.ts]: Disconnected from server on page: ${window.location.pathname}.`);
});
// Example: General server message listener (optional)
socket.on('serverMessage', (data) => {
    console.log(`[Socket.IO Client - main.ts]: Message from server:`, data);
});
// Listen for 'newOrderCreated' event (for notifications)
socket.on('newOrderCreated', (orderData) => {
    console.log('[Socket.IO Client - main.ts]: Event "newOrderCreated" received!', orderData);
    displayTemporaryNotification(orderData.message || `A new order for ${orderData.productName || 'an item'} was just placed!`);
});
// Listen for 'stockUpdate' event (this is a global listener)
socket.on('stockUpdate', (data) => {
    console.log('[Socket.IO Client - main.ts]: Event "stockUpdate" received:', data);
    // Dispatch a custom browser event that page-specific scripts can listen to.
    // This decouples main.ts from needing to know about specific page elements.
    const event = new CustomEvent('stockUpdatedOnPage', { detail: data });
    document.dispatchEvent(event);
});
// Helper function to display a temporary notification
function displayTemporaryNotification(message, duration = 5000) {
    const notificationArea = document.getElementById('notification-area') || createNotificationArea();
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'toast-notification'; // Add a class for styling
    notificationDiv.textContent = message;
    notificationArea.appendChild(notificationDiv);
    console.log(`[Notification - main.ts]: Displaying: "${message}"`);
    setTimeout(() => {
        notificationDiv.remove();
        if (notificationArea.childElementCount === 0 && notificationArea.id === 'dynamic-notification-area') {
            notificationArea.remove(); // Remove container if it was dynamically created and is now empty
        }
    }, duration);
}
function createNotificationArea() {
    let area = document.getElementById('dynamic-notification-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'dynamic-notification-area';
        area.style.position = 'fixed';
        area.style.bottom = '20px';
        area.style.right = '20px';
        area.style.zIndex = '1000'; // Ensure it's on top
        area.style.display = 'flex';
        area.style.flexDirection = 'column-reverse'; // New notifications appear on top
        document.body.appendChild(area);
    }
    return area;
}
// --- Initial Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    // console.log(`[main.ts - DOMContentLoaded] Fired on page: ${window.location.pathname}. Calling updateNav.`);
    updateNav(); // This will also call updateCartCount
});
//# sourceMappingURL=main.js.map