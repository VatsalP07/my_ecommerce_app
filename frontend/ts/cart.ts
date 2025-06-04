// frontend/ts/cart.ts
import { API_BASE_URL, getToken, updateNavAndCart, removeToken, escapeHtml } from './main.js';

const cartItemsContainer = document.getElementById('cart-items-container');
const cartSummarySection = document.getElementById('cart-summary-section');

// This is the checkout button that was part of your original Day 12 cart.html for SIMULATED payment.
// If you are moving to a separate checkout.html for actual Stripe, this button might be removed or changed
// to simply navigate to /checkout.html.
// For now, I'll keep the logic for it if the button ID exists.
const placeOrderTestBtn = document.getElementById('place-order-test-btn');
const checkoutMessageEl = document.getElementById('checkout-message') || document.createElement('p'); // Fallback
if (document.getElementById('checkout-message') === null && placeOrderTestBtn && placeOrderTestBtn.parentElement) {
    checkoutMessageEl.id = 'checkout-message'; // Ensure it has an ID
    checkoutMessageEl.className = "text-sm text-gray-600 mt-4";
    placeOrderTestBtn.parentElement.appendChild(checkoutMessageEl);
}


async function fetchCart() {
    if (!cartItemsContainer || !cartSummarySection) {
        console.warn("[cart.ts] Cart container or summary section not found in DOM.");
        return;
    }

    const token = getToken();
    if (!token) {
        cartItemsContainer.innerHTML = `
            <div class="text-center py-16 px-6">
                <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 class="mt-4 text-xl font-semibold text-gray-900">Your cart is a blank canvas!</h3>
                <p class="mt-2 text-base text-gray-500">Log in to see your items and start your masterpiece.</p>
                <div class="mt-8">
                    <a href="/login.html?redirect=/cart.html" 
                       class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105">
                        Login to View Your Cart
                    </a>
                </div>
            </div>`;
        cartSummarySection.innerHTML = `
            <div class="bg-gray-50 p-6 rounded-lg shadow">
                <h2 class="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Cart Summary</h2>
                <p class="text-center text-gray-500 py-4">Login to see your cart summary.</p>
            </div>`;
        updateNavAndCart();
        return;
    }

    cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 py-10">Loading your cart...</p>';
    cartSummarySection.innerHTML = `
        <div class="bg-gray-50 p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Cart Summary</h2>
            <p class="text-center text-gray-500 py-4">Loading summary...</p>
        </div>`;


    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.warn('[cart.ts]: Received 401 from /cart on fetchCart. Removing token.');
                removeToken(); // Remove invalid token
                updateNavAndCart(); // This will re-trigger fetchCart which then shows login prompt
                return; // Stop further processing for this call
            }
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message);
        }

        const result = await response.json();
        console.log("[cart.ts] Cart data fetched:", result.data);
        renderCart(result.data); // This will call renderCart again with actual data
        updateNavAndCart(); // Update nav cart count based on fetched data
    } catch (error: any) {
        console.error('[cart.ts] Failed to fetch cart:', error);
        cartItemsContainer.innerHTML = `<p class="text-center text-red-600 py-10">Error loading cart: ${escapeHtml(error.message)}</p>`;
        cartSummarySection.innerHTML = `
            <div class="bg-gray-50 p-6 rounded-lg shadow">
                <h2 class="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Cart Summary</h2>
                <p class="text-center text-red-500 py-4">Could not load cart summary.</p>
            </div>`;
    }
}

function renderCart(cart: any) {
    if (!cartItemsContainer || !cartSummarySection) {
        console.error("[cart.ts] renderCart: Critical DOM elements missing.");
        return;
    }

    const hasItems = cart && cart.items && cart.items.length > 0;

    if (!hasItems) {
        cartItemsContainer.innerHTML = `
            <div class="text-center py-16 px-6">
                <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 class="mt-4 text-xl font-semibold text-gray-900">Your cart is empty!</h3>
                <p class="mt-2 text-base text-gray-500">Add some amazing products to get started.</p>
                <div class="mt-8">
                    <a href="/"
                       class="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105">
                        Discover Products
                    </a>
                </div>
            </div>`;
        cartSummarySection.innerHTML = `
            <div class="bg-gray-50 p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Cart Summary</h2>
                <p class="text-center text-gray-500 py-4">Your cart is empty.</p>
            </div>`;
        return;
    }

    // Render cart items
    cartItemsContainer.innerHTML = `
        <div class="flow-root">
            <ul role="list" class="-my-6 divide-y divide-gray-200">
                ${cart.items.map((item: any) => `
                    <li class="cart-item py-6 flex flex-col sm:flex-row" data-cart-item-id="${item._id}">
                        <div class="h-32 w-32 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 self-center sm:self-start">
                            <img src="${escapeHtml(item.image || (item.product?.imageKeys && item.product.imageKeys.length > 0 ? item.product.imageKeys[0] : 'https://via.placeholder.com/100?text=No+Image'))}" 
                                 alt="${escapeHtml(item.name || item.product?.name)}" 
                                 class="h-full w-full object-cover object-center">
                        </div>

                        <div class="ml-0 sm:ml-4 mt-4 sm:mt-0 flex flex-1 flex-col">
                            <div>
                                <div class="flex justify-between text-base font-medium text-gray-900">
                                    <h3>
                                        <a href="/product-detail.html?id=${item.product?._id || item.product}" class="hover:text-indigo-700">${escapeHtml(item.name || item.product?.name)}</a>
                                    </h3>
                                    <p class="ml-4">$${(item.quantity * item.price).toFixed(2)}</p>
                                </div>
                                <p class="mt-1 text-sm text-gray-500">Unit Price: $${parseFloat(item.price).toFixed(2)}</p>
                            </div>
                            <div class="flex flex-1 items-end justify-between text-sm mt-3">
                                <div class="flex items-center border border-gray-300 rounded-md">
                                    <button class="item-quantity-decrease-btn px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-l-md" data-cart-item-id="${item._id}">-</button>
                                    <input type="number" id="quantity-${item._id}" 
                                           class="item-quantity-input w-12 text-center border-t border-b border-gray-300 py-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm appearance-none" 
                                           value="${item.quantity}" min="1" 
                                           data-product-stock="${item.product?.stock || 999}"
                                           data-cart-item-id="${item._id}">
                                    <button class="item-quantity-increase-btn px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-r-md" data-cart-item-id="${item._id}">+</button>
                                </div>
                                <div class="flex">
                                    <button type="button" class="remove-item-btn font-medium text-indigo-600 hover:text-indigo-500" data-cart-item-id="${item._id}">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    // Render cart summary and actions
    cartSummarySection.innerHTML = `
        <div class="bg-gray-50 p-6 rounded-lg shadow-md">
            <h2 class="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Order Summary</h2>
            <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <dt class="text-gray-600">Subtotal (<span id="total-items">${cart.totalQuantity?.toString() || '0'}</span> items)</dt>
                    <dd class="font-medium text-gray-900">$${parseFloat(cart.itemsPrice || cart.totalPrice || 0).toFixed(2)}</dd>
                </div>
                <!-- Placeholder for Shipping & Tax if you calculate them before checkout -->
                <div class="flex justify-between">
                    <dt class="text-gray-600">Shipping (Example)</dt>
                    <dd class="font-medium text-gray-900">$${parseFloat(cart.shippingPrice || 0).toFixed(2)}</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-gray-600">Tax (Example)</dt>
                    <dd class="font-medium text-gray-900">$${parseFloat(cart.taxPrice || 0).toFixed(2)}</dd>
                </div>
                <div class="flex justify-between text-base font-medium text-gray-900 border-t pt-3 mt-2">
                    <dt>Order total</dt>
                    <dd id="total-price">$${parseFloat(cart.totalPrice || 0).toFixed(2)}</dd>
                </div>
            </dl>
            
            <p class="mt-1 text-xs text-gray-500">Shipping and taxes might be further adjusted at checkout.</p>
            
            <div class="mt-6">
                <a href="/checkout.html" id="checkout-button"
                   class="w-full flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Proceed to Checkout
                </a>
            </div>
            <div class="mt-4 flex justify-between text-sm">
                <a href="/" type="button" class="font-medium text-indigo-600 hover:text-indigo-500">
                    <span aria-hidden="true">←</span> Continue Shopping
                </a>
                <button id="clear-cart-button" class="font-medium text-red-500 hover:text-red-700">Clear Cart</button>
            </div>
        </div>
    `;

    // Re-attach event listeners
    document.querySelectorAll('.item-quantity-input').forEach(input => {
        input.addEventListener('change', (e) => handleQuantityChange(e, 'direct')); // Pass type
        // input.addEventListener('input', (e) => handleQuantityChange(e, 'direct')); // Can be too aggressive
    });
    document.querySelectorAll('.item-quantity-decrease-btn').forEach(button => {
        button.addEventListener('click', (e) => handleQuantityChange(e, 'decrease'));
    });
    document.querySelectorAll('.item-quantity-increase-btn').forEach(button => {
        button.addEventListener('click', (e) => handleQuantityChange(e, 'increase'));
    });

    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', handleRemoveItem);
    });
    const clearCartBtnElement = document.getElementById('clear-cart-button');
    if(clearCartBtnElement) {
        clearCartBtnElement.addEventListener('click', handleClearCart);
    }
}

async function handleQuantityChange(event: Event, type: 'increase' | 'decrease' | 'direct') {
    const el = event.target as HTMLElement;
    const cartItemId = el.dataset.cartItemId;
    let quantityInput: HTMLInputElement | null;
    let currentQuantity: number;

    if (type === 'direct') {
        quantityInput = el as HTMLInputElement;
    } else { // 'increase' or 'decrease'
        // Find the input associated with the button
        const parentDiv = el.closest('div'); // The div containing input and buttons
        quantityInput = parentDiv?.querySelector('.item-quantity-input') as HTMLInputElement | null;
    }
    
    if (!quantityInput || !cartItemId) {
        console.error("[cart.ts] Could not find cart item ID or quantity input for change event.");
        return;
    }
    
    currentQuantity = parseInt(quantityInput.value);
    const maxStock = parseInt(quantityInput.dataset.productStock || "999");
    let newQuantity = currentQuantity;

    if (type === 'increase') {
        newQuantity = currentQuantity + 1;
    } else if (type === 'decrease') {
        newQuantity = currentQuantity - 1;
    } else { // 'direct' input
        newQuantity = parseInt(quantityInput.value);
    }

    if (isNaN(newQuantity) || newQuantity < 1) {
        newQuantity = 1; // Default to 1 if invalid or less than 1
    }
    if (newQuantity > maxStock) {
        alert(`Cannot exceed available stock (${maxStock}).`);
        newQuantity = maxStock;
    }
    
    quantityInput.value = newQuantity.toString(); // Update input field immediately for responsiveness

    // Only send API request if the quantity actually changes from what it was (or for direct input)
    // This simple check might not be enough if user types same number, but fine for +/- buttons
    if (newQuantity === currentQuantity && type !== 'direct' && newQuantity !== 1) { 
        // No change if +/- buttons didn't result in a valid change beyond bounds
        // or if it's the same as current and not a direct typed input.
        // If newQuantity is 1, it might be a correction, so let it proceed.
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart/items/${cartItemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ quantity: newQuantity })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update quantity');
        
        renderCart(result.data); 
        updateNavAndCart(); 
    } catch (error: any) {
        console.error('[cart.ts] Update quantity error:', error);
        alert(`Error updating quantity: ${error.message}`);
        fetchCart(); 
    }
}

async function handleRemoveItem(event: Event) {
    const button = event.target as HTMLButtonElement;
    const cartItemId = button.dataset.cartItemId;

    if (!cartItemId || !confirm('Are you sure you want to remove this item from your cart?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cart/items/${cartItemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to remove item');
        
        renderCart(result.data);
        updateNavAndCart();
    } catch (error: any) {
        console.error('[cart.ts] Remove item error:', error);
        alert(`Error removing item: ${error.message}`);
        fetchCart();
    }
}

async function handleClearCart() {
    if (!confirm('Are you sure you want to clear your entire cart?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to clear cart');
        renderCart(result.data); 
        updateNavAndCart();
    } catch (error: any) {
        console.error('[cart.ts] Clear cart error:', error);
        alert(`Error clearing cart: ${error.message}`);
    }
}

// Logic for the old placeOrderTestBtn (simulated payment from Day 12)
// This should ideally be on checkout.html now, but kept here if cart.html still has the button
if (placeOrderTestBtn) {
    placeOrderTestBtn.addEventListener('click', async () => {
        // ... (existing Day 12 simulated payment logic from your cart.ts) ...
        const token = getToken();
        if (!token) { alert('Please login to place an order.'); return; }
        if (!confirm('Confirm your order details and proceed to simulated payment?')) return;

        if (checkoutMessageEl) checkoutMessageEl.textContent = 'Creating order...';
        let createdOrderData: any = null;
        try {
            const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    shippingAddress: { address: '123 Sim St', city: 'Simville', postalCode: 'S1M00', country: 'Simland' },
                    paymentMethod: 'SimulatedPay'
                })
            });
            const orderResult = await orderResponse.json();
            if (!orderResponse.ok) throw new Error(orderResult.message || 'Failed to create order');
            createdOrderData = orderResult.data;
            if (checkoutMessageEl) checkoutMessageEl.textContent = `Order #${createdOrderData._id} created. Simulating payment...`;

            await new Promise(resolve => setTimeout(resolve, 2500));
            const paymentSuccess = Math.random() > 0.1;

            if (paymentSuccess) {
                if (checkoutMessageEl) checkoutMessageEl.textContent = 'Payment successful! Updating order status...';
                const payResponse = await fetch(`${API_BASE_URL}/orders/${createdOrderData._id}/pay`, {
                    method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
                });
                const payResult = await payResponse.json();
                if (!payResponse.ok) throw new Error(payResult.message || 'Failed to update order to paid');
                alert(`Order #${createdOrderData._id} placed and payment successful! Status: ${payResult.data.status}`);
                fetchCart(); // Cart should be empty now
                updateNavAndCart();
                if (checkoutMessageEl) checkoutMessageEl.textContent = '';
            } else {
                if (checkoutMessageEl) checkoutMessageEl.textContent = 'Simulated payment failed. Order created but payment pending.';
                alert('Payment simulation failed. Order created but payment pending.');
            }
        } catch (error: any) {
            console.error('Place order test error:', error);
            if (checkoutMessageEl) checkoutMessageEl.textContent = `Error: ${error.message}`;
            alert(`Checkout Error: ${error.message}`);
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('[cart.ts] DOMContentLoaded, calling initial updateNavAndCart and fetchCart.');
    updateNavAndCart(); // Ensures nav (auth links, cart count) is updated first
    fetchCart(); // Then fetch and render the cart content
});