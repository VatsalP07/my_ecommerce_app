// frontend/ts/main.ts
export const API_BASE_URL = 'http://localhost:5001/api/v1'; // Your backend API URL

// --- Token Management ---
export function getToken(): string | null {
    console.log(`[main.ts - getToken] Called on page: ${window.location.pathname}. Attempting to get 'authToken'.`);
    const token = localStorage.getItem('authToken');
    // This token should be the RAW token, without "Bearer "
    console.log(`[main.ts - getToken] Value from localStorage for 'authToken':`, token);
    return token;
}

export function setToken(receivedTokenValue: string): void {
    console.log('[main.ts - setToken] Attempting to set token. Received value:', receivedTokenValue);
    if (typeof receivedTokenValue === 'string' && receivedTokenValue.trim() !== '') {
        let tokenToStore = receivedTokenValue;
        // Normalize: Ensure we store the raw token without "Bearer " prefix
        if (receivedTokenValue.toLowerCase().startsWith('bearer ')) {
            tokenToStore = receivedTokenValue.substring(7).trim(); // Remove "Bearer " prefix and any extra spaces
            console.log('[main.ts - setToken] Removed "Bearer " prefix. Storing raw token:', tokenToStore);
        }

        if (tokenToStore === '') {
            console.error('[main.ts - setToken] Token became empty after stripping "Bearer ", not storing.');
            return;
        }

        try {
            localStorage.setItem('authToken', tokenToStore);
            const storedToken = localStorage.getItem('authToken');
            console.log('[main.ts - setToken] Token supposedly SET. Value read back from localStorage:', storedToken);
            if (tokenToStore !== storedToken) {
                console.error('[main.ts - setToken] CRITICAL MISMATCH! Token set was different from token read back!');
            }
        } catch (e) {
            console.error('[main.ts - setToken] Error setting item in localStorage:', e);
        }
    } else {
        console.error('[main.ts - setToken] Invalid token received (empty or not a string). Token was:', receivedTokenValue);
    }
}

export function removeToken(): void {
    console.log(`[main.ts - removeToken] Called on page: ${window.location.pathname}. Removing 'authToken'.`);
    localStorage.removeItem('authToken');
    // After removing, for immediate UI update if needed on the same interaction cycle
    // updateNav(); // Re-calling updateNav here might be useful in some scenarios, but can also cause loops if not careful.
                   // For now, let page reloads or explicit calls handle UI update after logout.
}


// --- Navigation and UI Updates ---
export function updateNav(): void {
    console.log(`[main.ts - updateNav] Called on page: ${window.location.pathname}.`);
    const authLinksContainer = document.getElementById('auth-links');
    const token = getToken(); // This now gets the raw token
    console.log(`[main.ts - updateNav] Current token from getToken():`, token);

    if (authLinksContainer) {
        if (token) { // If raw token exists and is not empty
            console.log('[main.ts - updateNav] Token exists. Setting up "Profile/Logout" links.');
            authLinksContainer.innerHTML = `
                <a href="#">Profile (TODO)</a>
                <a href="#" id="logout-link">Logout</a>
            `;
            const logoutLink = document.getElementById('logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('[main.ts - updateNav] Logout link clicked.');
                    removeToken();
                    alert('Logged out successfully!');
                    window.location.href = '/login.html'; // Redirect to login
                    // No need to call updateNav() here as the page is changing
                });
            }
        } else {
            console.log('[main.ts - updateNav] Token MISSING or empty. Setting up "Login/Register" links.');
            authLinksContainer.innerHTML = `
                <a href="/login.html">Login</a>
                <a href="/register.html">Register</a>
            `;
        }
    } else {
        console.warn(`[main.ts - updateNav] auth-links container not found on page: ${window.location.pathname}`);
    }
    // Always try to update cart count, it will handle token presence internally
    updateCartCount();
}

export async function updateCartCount(): Promise<void> {
    console.log(`[main.ts - updateCartCount] Called on page: ${window.location.pathname}.`);
    const cartCountSpan = document.getElementById('cart-count');
    if (!cartCountSpan) {
        console.warn(`[main.ts - updateCartCount] cart-count span not found on page: ${window.location.pathname}`);
        return;
    }

    const rawToken = getToken(); // Gets the raw token
    console.log(`[main.ts - updateCartCount] Raw token for cart fetch:`, rawToken);

    if (!rawToken) {
        console.log('[main.ts - updateCartCount] No token, setting cart count to 0.');
        cartCountSpan.textContent = '0';
        return;
    }

    try {
        console.log('[main.ts - updateCartCount] Fetching cart data...');
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: {
                // Correctly construct Authorization header with "Bearer " + raw token
                'Authorization': `Bearer ${rawToken}`
            }
        });

        console.log(`[main.ts - updateCartCount] /cart API response status: ${response.status}`);
        if (!response.ok) {
            if (response.status === 401) {
                console.error('[main.ts - updateCartCount] /cart API call returned 401 UNAUTHORIZED. Removing token.');
                removeToken(); // Token is invalid or expired, log out user
                updateNav();   // Explicitly update nav to reflect logged-out state immediately
            } else {
                console.error(`[main.ts - updateCartCount] Failed to fetch cart for count. Status: ${response.status}`);
            }
            cartCountSpan.textContent = '0'; // Set to 0 on any error fetching cart
            return;
        }

        const cartData = await response.json();
        console.log('[main.ts - updateCartCount] Cart data received:', cartData);
        if (cartData.data && typeof cartData.data.totalQuantity === 'number') {
            cartCountSpan.textContent = cartData.data.totalQuantity.toString();
        } else if (cartData.data && Array.isArray(cartData.data.items)) { // Fallback if totalQuantity virtual isn't there
            const quantity = cartData.data.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            cartCountSpan.textContent = quantity.toString();
        }
        else {
            console.warn('[main.ts - updateCartCount] Cart data received but format unexpected or items missing. Setting count to 0.');
            cartCountSpan.textContent = '0';
        }
    } catch (error) {
        console.error('[main.ts - updateCartCount] Network or other error updating cart count:', error);
        cartCountSpan.textContent = '0'; // Set to 0 on any error
    }
}

// --- Initial Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`[main.ts - DOMContentLoaded] Fired on page: ${window.location.pathname}. Calling updateNav.`);
    updateNav();
});