// frontend/ts/checkout.ts
import { API_BASE_URL, getToken, removeToken, updateNavAndCart, escapeHtml } from './main.js';
// --- IMPORTANT: REPLACE WITH YOUR ACTUAL STRIPE TEST PUBLISHABLE KEY IN YOUR LOCAL ENV ---
// For production, this key should ideally come from a backend endpoint or config injection, not hardcoded.
const STRIPE_PUBLISHABLE_KEY_FRONTEND = 'pk_test_51RUNHMCvLwGHDfvAOq3lAcVaxiac204BP7ubkHdq01shCMRam0O2GH9fdoRN6lsc1sDQcFUKsmrDOpO1Yt7GRSGS00cJNYdWmD'; // REPLACE THIS
// --- ---
// @ts-ignore - Stripe will be loaded from CDN
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY_FRONTEND);
const orderSummaryItemsDiv = document.getElementById('order-summary-items');
const summarySubtotalSpan = document.getElementById('summary-subtotal');
const summaryShippingSpan = document.getElementById('summary-shipping');
const summaryTaxSpan = document.getElementById('summary-tax');
const summaryTotalPriceSpan = document.getElementById('summary-total-price');
const confirmOrderPayBtn = document.getElementById('confirm-order-pay-btn');
const checkoutMessageEl = document.getElementById('checkout-message');
// Shipping Address Form Inputs
const shippingNameInput = document.getElementById('shipping-name');
const addressInput = document.getElementById('address');
const cityInput = document.getElementById('city');
const postalCodeInput = document.getElementById('postalCode');
const countryInput = document.getElementById('country');
async function fetchCartSummaryForCheckout() {
    console.log('[Checkout.ts] fetchCartSummaryForCheckout called');
    if (!orderSummaryItemsDiv || !summaryTotalPriceSpan || !summarySubtotalSpan || !summaryShippingSpan || !summaryTaxSpan) {
        console.error('[Checkout.ts] Missing summary DOM elements for checkout page.');
        return;
    }
    const token = getToken();
    if (!token) { // Should be caught by DOMContentLoaded listener redirect, but good check
        return;
    }
    orderSummaryItemsDiv.innerHTML = '<p class="text-xs text-gray-500">Loading summary items...</p>';
    summarySubtotalSpan.textContent = '...';
    summaryShippingSpan.textContent = '...';
    summaryTaxSpan.textContent = '...';
    summaryTotalPriceSpan.textContent = '...';
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('[Checkout.ts] Fetch cart summary response status:', response.status);
        if (!response.ok) {
            if (response.status === 401) {
                removeToken();
                alert('Your session has expired. Please log in again.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            const errorData = await response.json().catch(() => ({ message: `Failed to fetch cart summary. Status: ${response.status}` }));
            throw new Error(errorData.message);
        }
        const cartResult = await response.json();
        const cartData = cartResult.data;
        console.log('[Checkout.ts] Cart summary data:', cartData);
        if (!cartData || !cartData.items || cartData.items.length === 0) {
            orderSummaryItemsDiv.innerHTML = '<p class="text-sm text-gray-600">Your cart is empty. Cannot proceed to checkout.</p>';
            summarySubtotalSpan.textContent = '$0.00';
            summaryShippingSpan.textContent = '$0.00';
            summaryTaxSpan.textContent = '$0.00';
            summaryTotalPriceSpan.textContent = '$0.00';
            if (confirmOrderPayBtn)
                confirmOrderPayBtn.disabled = true;
            if (confirmOrderPayBtn)
                confirmOrderPayBtn.classList.add('opacity-50', 'cursor-not-allowed');
            return;
        }
        orderSummaryItemsDiv.innerHTML = `
            <ul class="space-y-2">
                ${cartData.items.map((item) => `
                    <li class="flex justify-between text-sm">
                        <span class="text-gray-600 w-3/4 truncate" title="${escapeHtml(item.name || item.product?.name)}">
                            ${escapeHtml(item.name || item.product?.name)} (x${item.quantity})
                        </span>
                        <span class="text-gray-800 font-medium">$${(item.price * item.quantity).toFixed(2)}</span>
                    </li>`).join('')}
            </ul>`;
        // Use calculated prices from cart if available (these are typically calculated on backend)
        summarySubtotalSpan.textContent = `$${parseFloat(cartData.itemsPrice || 0).toFixed(2)}`;
        summaryShippingSpan.textContent = `$${parseFloat(cartData.shippingPrice || 0).toFixed(2)}`; // Assuming cart calculates/stores this
        summaryTaxSpan.textContent = `$${parseFloat(cartData.taxPrice || 0).toFixed(2)}`; // Assuming cart calculates/stores this
        summaryTotalPriceSpan.textContent = `$${parseFloat(cartData.totalPrice || 0).toFixed(2)}`;
        if (confirmOrderPayBtn) {
            confirmOrderPayBtn.disabled = false;
            confirmOrderPayBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    catch (error) {
        console.error('[Checkout.ts] Error fetching cart summary:', error);
        orderSummaryItemsDiv.innerHTML = `<p class="text-sm text-red-600">Error loading summary: ${error.message}</p>`;
        if (confirmOrderPayBtn) {
            confirmOrderPayBtn.disabled = true;
            confirmOrderPayBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}
async function handleConfirmOrderAndPay() {
    console.log('[Checkout.ts] handleConfirmOrderAndPay function initiated.');
    if (!checkoutMessageEl || !shippingNameInput || !addressInput || !cityInput || !postalCodeInput || !countryInput) {
        console.error('[Checkout.ts] Critical checkout form DOM elements are missing.');
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = 'Page error: Form elements missing. Please refresh.';
            checkoutMessageEl.classList.remove('hidden');
        }
        return;
    }
    const token = getToken();
    if (!token) {
        alert('Authentication session expired. Please login again.');
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }
    const shippingAddress = {
        // name: shippingNameInput.value.trim(), // Add name if your backend Order schema expects it
        address: addressInput.value.trim(),
        city: cityInput.value.trim(),
        postalCode: postalCodeInput.value.trim(),
        country: countryInput.value.trim(),
    };
    const paymentMethod = "Stripe";
    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country /*|| !shippingAddress.name*/) {
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = 'Please fill in all shipping address fields.';
            checkoutMessageEl.classList.remove('hidden');
        }
        return;
    }
    if (checkoutMessageEl) {
        checkoutMessageEl.style.color = 'blue'; // Use Tailwind classes ideally: text-blue-600
        checkoutMessageEl.textContent = 'Processing order... Please wait.';
        checkoutMessageEl.classList.remove('hidden');
    }
    if (confirmOrderPayBtn)
        confirmOrderPayBtn.disabled = true;
    if (confirmOrderPayBtn)
        confirmOrderPayBtn.classList.add('opacity-50', 'cursor-not-allowed');
    let createdOrderData = null;
    try {
        console.log('[Checkout.ts] Sending POST /api/v1/orders to create order document...');
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shippingAddress, paymentMethod })
        });
        const orderResult = await orderResponse.json();
        console.log('[Checkout.ts] Create order API response status:', orderResponse.status);
        console.log('[Checkout.ts] Create order API response data:', orderResult);
        if (!orderResponse.ok || !orderResult.data || !orderResult.data.orderId) {
            const errorDetail = orderResult.message || (orderResult.errors ? JSON.stringify(orderResult.errors) : `Failed to create order (Status: ${orderResponse.status})`);
            throw new Error(errorDetail);
        }
        createdOrderData = orderResult.data;
        if (!createdOrderData || !createdOrderData.orderId) {
            throw new Error('Internal error: Failed to process valid order creation response.');
        }
        if (checkoutMessageEl)
            checkoutMessageEl.textContent = `Order #${createdOrderData.orderId.slice(-6)} created. Redirecting to Stripe...`;
        console.log(`[Checkout.ts] Creating Stripe session for order ID: ${createdOrderData.orderId}`);
        const stripeSessionResponse = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ orderId: createdOrderData.orderId })
        });
        const stripeSessionResult = await stripeSessionResponse.json();
        console.log('[Checkout.ts] Stripe session API response:', stripeSessionResult);
        if (!stripeSessionResponse.ok || !stripeSessionResult.sessionId) {
            throw new Error(stripeSessionResult.message || 'Failed to create Stripe payment session.');
        }
        const { sessionId } = stripeSessionResult;
        console.log(`[Checkout.ts] Redirecting to Stripe Checkout with session ID: ${sessionId}`);
        // @ts-ignore - Stripe is global
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
        if (stripeError) {
            console.error('[Checkout.ts] Stripe redirectToCheckout error:', stripeError);
            if (checkoutMessageEl) {
                checkoutMessageEl.style.color = 'red';
                checkoutMessageEl.textContent = `Payment Error: ${stripeError.message}`;
                checkoutMessageEl.classList.remove('hidden');
            }
            alert(`Payment Error: ${stripeError.message}`);
        }
    }
    catch (error) {
        console.error('[Checkout.ts] Checkout process error:', error);
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = `Error: ${error.message}`;
            checkoutMessageEl.classList.remove('hidden');
        }
    }
    finally {
        if (confirmOrderPayBtn) {
            confirmOrderPayBtn.disabled = false;
            confirmOrderPayBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Checkout.ts] DOMContentLoaded: Script is running.');
    updateNavAndCart();
    const token = getToken();
    if (!token) {
        console.log('[Checkout.ts] No token on DOMContentLoaded, redirecting to login.');
        alert('Please login to proceed to checkout.');
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }
    fetchCartSummaryForCheckout(); // Fetch and display cart summary for checkout page
    if (confirmOrderPayBtn) {
        confirmOrderPayBtn.addEventListener('click', handleConfirmOrderAndPay);
    }
    else {
        console.error('[Checkout.ts] DOMContentLoaded: ERROR - Confirm Order & Pay button (confirm-order-pay-btn) NOT FOUND!');
    }
    const queryParams = new URLSearchParams(window.location.search);
    const stripeSessionIdParam = queryParams.get('session_id');
    const cancelledOrderIdParam = queryParams.get('order_id');
    if (stripeSessionIdParam) {
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'green'; // text-green-600
            checkoutMessageEl.textContent = 'Payment successful! Redirecting to confirmation...';
            checkoutMessageEl.classList.remove('hidden');
        }
        // Redirect to the actual success page, Stripe might not always do this if success_url has issues.
        // The success page will show the session_id from its own URL params.
        // Webhook will handle order update.
        setTimeout(() => {
            window.location.href = `/order-success.html?session_id=${stripeSessionIdParam}`;
        }, 2000);
    }
    else if (cancelledOrderIdParam) {
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'orange'; // text-yellow-600
            checkoutMessageEl.textContent = `Your payment was cancelled. Your order #${cancelledOrderIdParam.slice(-6)} is pending.`;
            checkoutMessageEl.classList.remove('hidden');
        }
    }
});
