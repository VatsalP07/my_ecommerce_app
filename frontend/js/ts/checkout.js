// frontend/ts/checkout.ts
import { API_BASE_URL, getToken, removeToken, updateNavAndCart } from './main.js'; // Assuming updateNavAndCart calls updateCartCount
// --- IMPORTANT: REPLACE WITH YOUR ACTUAL STRIPE TEST PUBLISHABLE KEY ---
const STRIPE_PUBLISHABLE_KEY_FRONTEND = 'pk_test_51RUNHMCvLwGHDfvAOq3lAcVaxiac204BP7ubkHdq01shCMRam0O2GH9fdoRN6lsc1sDQcFUKsmrDOpO1Yt7GRSGS00cJNYdWmD';
// --- ---
// @ts-ignore - Stripe will be loaded from CDN
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY_FRONTEND);
const orderSummaryItemsDiv = document.getElementById('order-summary-items');
const summaryTotalPriceSpan = document.getElementById('summary-total-price');
const confirmOrderPayBtn = document.getElementById('confirm-order-pay-btn');
const checkoutMessageEl = document.getElementById('checkout-message');
const addressInput = document.getElementById('address');
const cityInput = document.getElementById('city');
const postalCodeInput = document.getElementById('postalCode');
const countryInput = document.getElementById('country');
// const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement | null; // Not directly used if only Stripe
async function fetchCartSummaryForCheckout() {
    console.log('[Checkout.ts] fetchCartSummaryForCheckout called');
    if (!orderSummaryItemsDiv || !summaryTotalPriceSpan) {
        console.error('[Checkout.ts] Missing summary DOM elements.');
        return;
    }
    const token = getToken();
    if (!token) {
        // Redirect handled by DOMContentLoaded check
        return;
    }
    orderSummaryItemsDiv.innerHTML = '<p>Loading cart summary...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('[Checkout.ts] Fetch cart summary response status:', response.status);
        if (!response.ok) {
            if (response.status === 401) {
                removeToken(); // Token might be invalid
                alert('Your session has expired. Please log in again.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                return; // Stop further execution
            }
            const errorData = await response.json().catch(() => ({ message: `Failed to fetch cart summary. Status: ${response.status}` }));
            throw new Error(errorData.message);
        }
        const cartResult = await response.json();
        const cartData = cartResult.data;
        console.log('[Checkout.ts] Cart summary data:', cartData);
        if (!cartData || !cartData.items || cartData.items.length === 0) {
            orderSummaryItemsDiv.innerHTML = '<p>Your cart is empty. <a href="/">Continue shopping</a>.</p>';
            summaryTotalPriceSpan.textContent = '0.00';
            if (confirmOrderPayBtn)
                confirmOrderPayBtn.disabled = true;
            return;
        }
        orderSummaryItemsDiv.innerHTML = `
            <h4>Order Items:</h4>
            <ul>
                ${cartData.items.map((item) => `<li>${item.name || item.product?.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
            </ul>`;
        summaryTotalPriceSpan.textContent = cartData.totalPrice?.toFixed(2) || '0.00';
        if (confirmOrderPayBtn)
            confirmOrderPayBtn.disabled = false;
    }
    catch (error) {
        console.error('[Checkout.ts] Error fetching cart summary:', error);
        orderSummaryItemsDiv.innerHTML = `<p>Error loading summary: ${error.message}</p>`;
        if (confirmOrderPayBtn)
            confirmOrderPayBtn.disabled = true;
    }
}
async function handleConfirmOrderAndPay() {
    console.log('[Checkout.ts] handleConfirmOrderAndPay function initiated.');
    if (!checkoutMessageEl || !addressInput || !cityInput || !postalCodeInput || !countryInput) { // Removed paymentMethodSelect from check
        console.error('[Checkout.ts] Critical checkout form DOM elements are missing.');
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = 'Page error: Form elements missing. Please refresh.';
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
        address: addressInput.value.trim(),
        city: cityInput.value.trim(),
        postalCode: postalCodeInput.value.trim(),
        country: countryInput.value.trim(),
    };
    // const paymentMethod = paymentMethodSelect.value; // We'll default to Stripe
    const paymentMethod = "Stripe"; // Hardcode for now as we are integrating Stripe
    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
        checkoutMessageEl.style.color = 'red';
        checkoutMessageEl.textContent = 'Please fill in all shipping address fields.';
        return;
    }
    checkoutMessageEl.style.color = 'blue';
    checkoutMessageEl.textContent = 'Processing order... Please wait.';
    if (confirmOrderPayBtn)
        confirmOrderPayBtn.disabled = true;
    let createdOrderData = null;
    try {
        // Step 1: Create the order in your system with "Awaiting Payment" status
        // The backend /orders route was updated in Day 14 to NOT expect orderItems in payload if using cart
        // It will fetch the cart itself using the user's token.
        console.log('[Checkout.ts] Sending POST /api/v1/orders to create order document...');
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                shippingAddress,
                paymentMethod // This will be "Stripe"
            })
        });
        const orderResult = await orderResponse.json();
        console.log('[Checkout.ts] Create order API response status:', orderResponse.status);
        console.log('[Checkout.ts] Create order API response data:', orderResult);
        if (!orderResponse.ok || !orderResult.data || !orderResult.data.orderId) {
            const errorDetail = orderResult.message || (orderResult.errors ? JSON.stringify(orderResult.errors) : `Failed to create order (Status: ${orderResponse.status})`);
            throw new Error(errorDetail);
        }
        createdOrderData = orderResult.data; // This should contain { orderId: '...', totalPrice: ..., status: '...' }
        if (!createdOrderData || !createdOrderData.orderId) {
            console.error('[Checkout.ts] Order data from backend is invalid or missing orderId after creation!', createdOrderData);
            throw new Error('Internal error: Failed to process valid order creation response.');
        }
        checkoutMessageEl.textContent = `Order #${createdOrderData.orderId} created. Redirecting to Stripe for payment...`;
        // Step 2: Create Stripe Checkout Session
        console.log(`[Checkout.ts] Creating Stripe session for order ID: ${createdOrderData.orderId}`);
        const stripeSessionResponse = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ orderId: createdOrderData.orderId }) // Send the orderId created by your backend
        });
        const stripeSessionResult = await stripeSessionResponse.json();
        console.log('[Checkout.ts] Stripe session API response:', stripeSessionResult);
        if (!stripeSessionResponse.ok || !stripeSessionResult.sessionId) {
            throw new Error(stripeSessionResult.message || 'Failed to create Stripe payment session.');
        }
        const { sessionId } = stripeSessionResult;
        // Step 3: Redirect to Stripe Checkout
        console.log(`[Checkout.ts] Redirecting to Stripe Checkout with session ID: ${sessionId}`);
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
        if (stripeError) {
            console.error('[Checkout.ts] Stripe redirectToCheckout error:', stripeError);
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = `Payment Error: ${stripeError.message}`;
            alert(`Payment Error: ${stripeError.message}`);
            if (confirmOrderPayBtn)
                confirmOrderPayBtn.disabled = false; // Re-enable button on Stripe client-side error
        }
        // If redirectToCheckout is successful, the user is navigated away.
        // If it fails, the error is handled above.
    }
    catch (error) {
        console.error('[Checkout.ts] Checkout process error:', error);
        checkoutMessageEl.style.color = 'red';
        checkoutMessageEl.textContent = `Error: ${error.message}`;
        if (confirmOrderPayBtn)
            confirmOrderPayBtn.disabled = false;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Checkout.ts] DOMContentLoaded: Script is running.');
    updateNavAndCart(); // Call this to update nav and cart count
    const token = getToken();
    if (!token) {
        console.log('[Checkout.ts] No token on DOMContentLoaded, redirecting to login.');
        alert('Please login to proceed to checkout.');
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return; // Stop further execution if not logged in
    }
    fetchCartSummaryForCheckout();
    console.log('[Checkout.ts] DOMContentLoaded: Confirm Order Button Element (confirmOrderPayBtn global):', confirmOrderPayBtn);
    if (confirmOrderPayBtn) {
        console.log('[Checkout.ts] DOMContentLoaded: Attaching click listener to confirm-order-pay-btn');
        confirmOrderPayBtn.addEventListener('click', handleConfirmOrderAndPay);
    }
    else {
        console.error('[Checkout.ts] DOMContentLoaded: ERROR - Confirm Order & Pay button (confirm-order-pay-btn) NOT FOUND in DOM!');
    }
    // Handle redirection from Stripe
    const queryParams = new URLSearchParams(window.location.search);
    const stripeSessionId = queryParams.get('session_id'); // From Stripe success_url
    const cancelledStripeOrderId = queryParams.get('order_id'); // From Stripe cancel_url (if you passed it)
    if (stripeSessionId) {
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'green';
            checkoutMessageEl.textContent = 'Payment successful! Thank you for your order. We are processing it. You will be redirected shortly.';
            console.log("[Checkout.ts] Stripe Checkout Session ID (Success):", stripeSessionId);
        }
        updateNavAndCart(); // Update cart (should be empty after webhook processes)
        // Redirect to a dedicated success page or homepage after a delay
        setTimeout(() => {
            // Ideally, fetch the order status here before redirecting to be sure.
            // For now, redirecting to a generic success page or home.
            window.location.href = `/order-success.html?session_id=${stripeSessionId}`; // Or just '/'
        }, 4000);
    }
    else if (cancelledStripeOrderId) {
        if (checkoutMessageEl) {
            checkoutMessageEl.style.color = 'orange';
            checkoutMessageEl.textContent = `Your payment was cancelled for order ${cancelledStripeOrderId}. Your order is still pending payment.`;
            console.log("[Checkout.ts] Payment Cancelled for Order ID:", cancelledStripeOrderId);
        }
        // No need to disable button here, user might want to try again or go back to cart
    }
});
