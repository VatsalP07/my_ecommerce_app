// frontend/ts/main.ts
export const API_BASE_URL = '/api/v1'; // For Nginx proxy
// @ts-ignore - io is global from CDN
const socket = io({
    transports: ['websocket', 'polling']
});
console.log('[Frontend]: main.ts loaded. Attempting Socket.IO connection...');
socket.on('connect', () => {
    console.log(`%c[Socket.IO Client]: CONNECTED! Socket ID: ${socket.id}`, "color: green; font-weight: bold;");
});
socket.on('disconnect', (reason) => {
    console.warn(`[Socket.IO Client]: DISCONNECTED. Reason: ${reason}. Page: ${window.location.pathname}`);
});
socket.on('connect_error', (err) => {
    console.error(`[Socket.IO Client]: CONNECTION ERROR. Name: ${err.name}, Message: ${err.message}`, err);
});
// --- Standard Socket Event Listeners ---
socket.on('serverMessage', (data) => {
    console.log('[Socket.IO Client]: Received serverMessage:', data.text);
});
socket.on('newOrderCreated', (orderData) => {
    console.log('[Socket.IO Client]: New order created (pre-payment) event:', orderData);
});
socket.on('stockUpdate', (data) => {
    console.log('[Socket.IO Client]: Stock update event:', data);
    const event = new CustomEvent('stockUpdatedOnPage', { detail: data });
    document.dispatchEvent(event);
});
socket.on('orderPaymentSuccess', (data) => {
    console.log('[Socket.IO Client]: Order Payment Success event:', data);
    const currentTokenPayload = getTokenPayload();
    if (currentTokenPayload && currentTokenPayload.sub === data.userId) {
        displayTemporaryNotification(data.message || `Payment for order ${data.orderId} successful!`);
        updateCartCount();
        if (window.location.pathname.includes('/checkout.html') || window.location.pathname.includes('/cart.html')) {
            const cartItemsContainer = document.getElementById('cart-items-container');
            if (cartItemsContainer) {
                cartItemsContainer.innerHTML = `<p>Order #${data.orderId} paid! <a href="/my-orders.html">View Orders (TODO)</a></p>`;
            }
        }
    }
    else {
        console.log(`[Socket.IO Client]: Order payment success for another user (ID: ${data.userId}).`);
    }
});
// --- Chat MVP Logic ---
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
            alert('Please login to use chat.');
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
            displayMessageInChat({ sender: 'System', text: 'Connecting...' });
        }
    });
}
if (chatSendButton && chatInput) {
    const sendLogic = () => {
        const messageText = chatInput.value.trim();
        if (messageText && chatJoined) {
            socket.emit('sendChatMessage', { text: messageText });
            displayMessageInChat({ sender: 'You', text: messageText });
            chatInput.value = '';
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
    if (message.sender === 'You' && document.querySelector('#chat-messages div:last-child')?.textContent?.includes(message.text))
        return;
    if (chatWidgetContainer && chatWidgetContainer.style.display !== 'none') {
        displayMessageInChat(message);
    }
});
function displayMessageInChat(message) {
    if (chatMessagesDiv) {
        const messageEl = document.createElement('div');
        messageEl.style.marginBottom = '8px';
        if (message.sender === 'You') {
            messageEl.style.textAlign = 'right';
            messageEl.innerHTML = `${escapeHtml(message.text)} :<strong>ME</strong>`;
        }
        else {
            messageEl.innerHTML = `<strong>${escapeHtml(message.sender)}:</strong> ${escapeHtml(message.text)}`;
        }
        chatMessagesDiv.appendChild(messageEl);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }
}
// --- UI Helper Functions ---
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
export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// --- Auth & Nav Logic ---
export function getToken() {
    return localStorage.getItem('authToken');
}
export function setToken(receivedTokenValue) {
    if (typeof receivedTokenValue === 'string' && receivedTokenValue.trim() !== '') {
        let tokenToStore = receivedTokenValue;
        if (receivedTokenValue.toLowerCase().startsWith('bearer ')) {
            tokenToStore = receivedTokenValue.substring(7).trim();
        }
        if (tokenToStore === '') {
            console.error('[DEBUG Main - setToken] Token empty after strip.');
            return;
        }
        localStorage.setItem('authToken', tokenToStore);
    }
    else {
        console.error('[DEBUG Main - setToken] Attempted to set invalid token.');
    }
}
export function removeToken() {
    console.log('[DEBUG Main - removeToken] Token removed.');
    localStorage.removeItem('authToken');
}
function getTokenPayload() {
    const token = getToken();
    if (!token)
        return null;
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url)
            throw new Error("Invalid JWT: Missing payload.");
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    }
    catch (e) {
        console.error("[DEBUG Main - getTokenPayload] Error decoding token:", e.message);
        return null;
    }
}
function updateNavUI(token) {
    const authLinksContainers = [
        { id: 'auth-links', loggedInHTML: `<a href="#" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Profile</a> <a href="#" id="logout-link" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Logout</a>`, loggedOutHTML: `<a href="/login.html" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Login</a> <a href="/register.html" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Register</a>`, logoutButtonId: 'logout-link', defaultRedirect: '/login.html' },
        { id: 'auth-links-admin', loggedInHTML: `<a href="#" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Admin</a> <a href="#" id="admin-logout-link" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Logout</a>`, loggedOutHTML: `<a href="/login.html" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Login</a> <a href="/register.html" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Register</a>`, logoutButtonId: 'admin-logout-link', defaultRedirect: '/login.html?redirect=/admin/products.html' }
    ];
    authLinksContainers.forEach(navConfig => {
        const container = document.getElementById(navConfig.id);
        if (container) {
            container.innerHTML = token ? navConfig.loggedInHTML : navConfig.loggedOutHTML;
            if (token) {
                const logoutLink = document.getElementById(navConfig.logoutButtonId);
                if (logoutLink) {
                    const newLogoutLink = logoutLink.cloneNode(true);
                    logoutLink.parentNode?.replaceChild(newLogoutLink, logoutLink);
                    newLogoutLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        removeToken();
                        alert('Logged out!');
                        updateNavAndCart();
                        window.location.href = navConfig.defaultRedirect;
                    });
                }
            }
        }
    });
    console.log('[DEBUG Main - updateNavUI]: Nav UI update complete. Token:', token ? 'Present' : 'Absent');
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
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('[DEBUG CartCount]: 401 from /cart.');
                removeToken();
                updateNavUI(null);
            }
            else {
                console.error('[DEBUG CartCount]: Failed status:', response.status);
            }
            cartCountSpans.forEach(span => span.textContent = '0');
            return;
        }
        const cartData = await response.json();
        const count = cartData.data?.totalQuantity?.toString() || '0';
        cartCountSpans.forEach(span => span.textContent = count);
    }
    catch (error) {
        console.error('[DEBUG CartCount]: Error:', error);
        cartCountSpans.forEach(span => span.textContent = '0');
    }
}
export async function updateNavAndCart() {
    console.log('[DEBUG Main - updateNavAndCart]: Called.');
    const token = getToken();
    updateNavUI(token);
    await updateCartCount();
}
// --- CATEGORIES DROPDOWN LOGIC ---
const categoriesBtn = document.getElementById('categories-btn');
const categoriesDropdown = document.getElementById('categories-dropdown');
if (categoriesBtn && categoriesDropdown) {
    categoriesBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        categoriesDropdown.classList.toggle('hidden');
        categoriesBtn.setAttribute('aria-expanded', categoriesDropdown.classList.contains('hidden') ? 'false' : 'true');
    });
    document.addEventListener('click', (event) => {
        if (!categoriesDropdown.classList.contains('hidden') && !categoriesBtn.contains(event.target) && !categoriesDropdown.contains(event.target)) {
            categoriesDropdown.classList.add('hidden');
            categoriesBtn.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !categoriesDropdown.classList.contains('hidden')) {
            categoriesDropdown.classList.add('hidden');
            categoriesBtn.setAttribute('aria-expanded', 'false');
        }
    });
}
// ************************************************************************** //
// **NEWLY ADDED FOR NAVIGATION SEARCH BAR (DAY 19 UI ENHANCEMENTS)**      //
// ************************************************************************** //
const navSearchInput = document.getElementById('nav-search-input');
const navSearchButton = document.getElementById('nav-search-btn');
function handleNavSearch() {
    if (navSearchInput) {
        const searchTerm = navSearchInput.value.trim();
        if (searchTerm) {
            console.log(`[Main.ts - NavSearch] Search initiated for: "${searchTerm}"`);
            // Redirect to the homepage (product list page) with the search query parameter.
            // The productList.ts script will detect this parameter and fetch search results.
            window.location.href = `/?search=${encodeURIComponent(searchTerm)}`;
        }
        else {
            // If search input is empty, you could simply redirect to homepage without search,
            // or do nothing if already on homepage. For now, let's just log it.
            console.log('[Main.ts - NavSearch] Search term is empty, no action taken.');
            // window.location.href = `/`; // Optional: redirect to clean homepage
        }
    }
}
if (navSearchButton) {
    navSearchButton.addEventListener('click', (e) => {
        e.preventDefault(); // Important if the button is of type="submit" inside a form
        handleNavSearch();
    });
}
if (navSearchInput) {
    navSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission if inside a form
            handleNavSearch();
        }
    });
}
// ************************************************************************** //
// **END OF NAVIGATION SEARCH BAR SECTION**                                //
// ************************************************************************** //
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG Main]: DOMContentLoaded - calling initial updateNavAndCart()');
    updateNavAndCart();
});
