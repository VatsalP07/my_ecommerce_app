// frontend/ts/main.ts
export const API_BASE_URL = '/api/v1'; // For Nginx proxy
// @ts-ignore - io is global from CDN
const socket = io({
    transports: ['websocket', 'polling']
});
console.log('[Frontend]: main.ts loaded. Attempting Socket.IO connection via Nginx...');
socket.on('connect', () => {
    console.log(`%c[Socket.IO Client]: CONNECTED to server! Socket ID: ${socket.id}`, "color: green; font-weight: bold;");
});
socket.on('disconnect', (reason) => {
    console.warn(`[Socket.IO Client]: DISCONNECTED from server. Reason: ${reason}. Page: ${window.location.pathname}`);
});
socket.on('connect_error', (err) => {
    console.error(`[Socket.IO Client]: CONNECTION ERROR. Name: ${err.name}, Message: ${err.message}`, err);
});
socket.on('serverMessage', (data) => {
    console.log('[Socket.IO Client]: Received serverMessage:', data.text);
});
socket.on('newOrderCreated', (orderData) => {
    console.log('[Socket.IO Client]: New order created event received!', orderData);
    displayTemporaryNotification(orderData.message || `A new order for ${orderData.productName || 'an item'} was just placed!`);
});
socket.on('stockUpdate', (data) => {
    console.log('[Socket.IO Client]: Stock update event received:', data);
    const event = new CustomEvent('stockUpdatedOnPage', { detail: data });
    document.dispatchEvent(event);
});
// Chat MVP Logic
const chatToggleButton = document.getElementById('chat-toggle-button');
const chatWidgetContainer = document.getElementById('chat-widget-container');
const chatMessagesDiv = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendButton = document.getElementById('chat-send-button');
let chatJoined = false;
if (chatToggleButton && chatWidgetContainer) {
    chatToggleButton.addEventListener('click', () => {
        const token = getToken();
        if (!token) {
            alert('Please login to use the chat feature.');
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return;
        }
        const isHidden = chatWidgetContainer.style.display === 'none' || chatWidgetContainer.style.display === '';
        chatWidgetContainer.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && !chatJoined) {
            socket.emit('joinChat');
            chatJoined = true;
            if (chatMessagesDiv)
                chatMessagesDiv.innerHTML = '';
            displayMessageInChat({ sender: 'System', text: 'Connecting to support...' });
        }
    });
}
if (chatSendButton && chatInput) {
    const sendLogic = () => {
        const messageText = chatInput.value.trim();
        if (messageText && chatJoined) {
            socket.emit('sendChatMessage', { text: messageText });
            chatInput.value = '';
        }
        else if (!chatJoined) {
            displayMessageInChat({ sender: 'System', text: 'Please open chat first.' });
        }
    };
    chatSendButton.addEventListener('click', sendLogic);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendLogic();
        }
    });
}
socket.on('chatMessage', (message) => {
    if (chatWidgetContainer && chatWidgetContainer.style.display !== 'none') {
        displayMessageInChat(message);
    }
});
function displayMessageInChat(message) {
    if (chatMessagesDiv) {
        const messageEl = document.createElement('div');
        messageEl.style.marginBottom = '8px';
        messageEl.innerHTML = `<strong>${escapeHtml(message.sender)}:</strong> ${escapeHtml(message.text)}`;
        chatMessagesDiv.appendChild(messageEl);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }
}
function displayTemporaryNotification(message, duration = 7000) {
    const notificationArea = document.getElementById('notification-area') || createNotificationArea();
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'toast-notification';
    notificationDiv.textContent = escapeHtml(message);
    notificationArea.appendChild(notificationDiv);
    setTimeout(() => {
        notificationDiv.classList.add('fade-out');
        setTimeout(() => {
            notificationDiv.remove();
            if (notificationArea.childElementCount === 0 && notificationArea.id === 'dynamic-notification-area') {
                notificationArea.remove();
            }
        }, 500);
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
        area.style.zIndex = '10000';
        area.style.display = 'flex';
        area.style.flexDirection = 'column-reverse';
        document.body.appendChild(area);
    }
    return area;
}
export function getToken() {
    const token = localStorage.getItem('authToken');
    console.log(`[DEBUG Main - getToken] Value from localStorage: ${token ? token.substring(0, 20) + '...' : 'NULL'}`);
    return token; // This should be the RAW token as it was stored
}
export function setToken(receivedTokenValue) {
    console.log('[DEBUG Main - setToken] Received value (first 20 chars):', receivedTokenValue ? receivedTokenValue.substring(0, 20) : 'EMPTY/NULL');
    if (typeof receivedTokenValue === 'string' && receivedTokenValue.trim() !== '') {
        let tokenToStore = receivedTokenValue;
        // If backend sends "Bearer <token>", strip "Bearer " before storing,
        // because our fetch calls will add "Bearer " back.
        if (receivedTokenValue.toLowerCase().startsWith('bearer ')) {
            tokenToStore = receivedTokenValue.substring(7).trim();
            console.log('[DEBUG Main - setToken] "Bearer " prefix found and stripped. Storing raw token starting with:', tokenToStore.substring(0, 20));
        }
        else {
            console.log('[DEBUG Main - setToken] No "Bearer " prefix found. Storing token as is, starting with:', tokenToStore.substring(0, 20));
        }
        if (tokenToStore === '') {
            console.error('[DEBUG Main - setToken] Token became empty after potential stripping, NOT storing.');
            return;
        }
        localStorage.setItem('authToken', tokenToStore); // Store only the raw token
        const stored = localStorage.getItem('authToken');
        console.log('[DEBUG Main - setToken] Token stored. Value read back starts with:', stored ? stored.substring(0, 20) : 'NULL');
    }
    else {
        console.error('[DEBUG Main - setToken] Attempted to set an invalid or empty token.');
    }
}
export function removeToken() {
    // Specific context logs will be at call sites
    localStorage.removeItem('authToken');
}
export async function updateCartCount() {
    const cartCountSpans = document.querySelectorAll('#cart-count');
    if (cartCountSpans.length === 0)
        return;
    const token = getToken();
    if (!token) {
        cartCountSpans.forEach(span => span.textContent = '0');
        return;
    }
    console.log('[DEBUG Cart]: updateCartCount() - Attempting to fetch cart. Token present.');
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('[DEBUG Cart]: Cart fetch response status:', response.status);
        if (!response.ok) {
            if (response.status === 401) {
                console.log('[DEBUG Cart]: Received 401 from /cart. About to call removeToken() from updateCartCount.');
                removeToken();
                console.log('[DEBUG Cart]: Token removed by updateCartCount. Calling updateNavUI to refresh UI.');
                updateNavUI(null);
            }
            else {
                console.error('[DEBUG Cart]: Failed to fetch cart for count, status:', response.status);
            }
            cartCountSpans.forEach(span => span.textContent = '0');
            return;
        }
        const cartData = await response.json();
        const count = cartData.data?.totalQuantity?.toString() || '0';
        console.log('[DEBUG Cart]: Cart count fetched:', count);
        cartCountSpans.forEach(span => span.textContent = count);
    }
    catch (error) {
        console.error('[DEBUG Cart]: Error updating cart count:', error);
        cartCountSpans.forEach(span => span.textContent = '0');
    }
}
function updateNavUI(token) {
    const authLinksContainer = document.getElementById('auth-links');
    const authLinksAdminContainer = document.getElementById('auth-links-admin');
    const loggedInLinksMain = `<a href="#">Profile (TODO)</a> <a href="#" id="logout-link">Logout</a>`;
    const loggedInLinksAdmin = `<a href="#">Admin Profile (TODO)</a> <a href="#" id="admin-logout-link">Logout</a>`;
    const loggedOutLinks = `<a href="/login.html">Login</a> <a href="/register.html">Register</a>`;
    const setupLogoutHandler = (buttonId, redirectPath = '/login.html') => {
        const logoutLink = document.getElementById(buttonId);
        if (logoutLink) {
            const newLogoutLink = logoutLink.cloneNode(true); // Clone to remove old listeners
            logoutLink.parentNode?.replaceChild(newLogoutLink, logoutLink);
            newLogoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`[DEBUG Auth]: Logout clicked (${buttonId}). About to call removeToken().`);
                removeToken();
                alert('Logged out successfully!');
                window.location.href = redirectPath;
            });
        }
    };
    if (authLinksContainer) {
        authLinksContainer.innerHTML = token ? loggedInLinksMain : loggedOutLinks;
        if (token)
            setupLogoutHandler('logout-link');
    }
    if (authLinksAdminContainer) {
        const adminRedirect = window.location.pathname.startsWith('/admin/') ? '/login.html?redirect=/admin/products.html' : '/login.html';
        authLinksAdminContainer.innerHTML = token ? loggedInLinksAdmin : loggedOutLinks;
        if (token)
            setupLogoutHandler('admin-logout-link', adminRedirect);
    }
    console.log('[DEBUG Nav]: Nav UI updated. Token status:', token ? 'Logged In' : 'Logged Out');
}
export async function updateNavAndCart() {
    console.log('[DEBUG Nav]: updateNavAndCart called.');
    const token = getToken();
    updateNavUI(token);
    if (token) {
        await updateCartCount();
    }
    else {
        const cartCountSpans = document.querySelectorAll('#cart-count');
        cartCountSpans.forEach(span => span.textContent = '0');
    }
}
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string')
        return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG Nav]: DOMContentLoaded - calling updateNavAndCart()');
    updateNavAndCart();
});
