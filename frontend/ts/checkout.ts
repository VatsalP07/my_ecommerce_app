// frontend/ts/checkout.ts
import { API_BASE_URL, getToken, removeToken, updateNavAndCart } from './main.js';

const orderSummaryItemsDiv = document.getElementById('order-summary-items');
const summaryTotalPriceSpan = document.getElementById('summary-total-price');
const confirmOrderPayBtn = document.getElementById('confirm-order-pay-btn') as HTMLButtonElement | null;
const checkoutMessageEl = document.getElementById('checkout-message');

const addressInput = document.getElementById('address') as HTMLInputElement | null;
const cityInput = document.getElementById('city') as HTMLInputElement | null;
const postalCodeInput = document.getElementById('postalCode') as HTMLInputElement | null;
const countryInput = document.getElementById('country') as HTMLInputElement | null;
const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement | null;

async function fetchCartSummaryForCheckout() {
    console.log('[Checkout.ts] fetchCartSummaryForCheckout called');
    if (!orderSummaryItemsDiv || !summaryTotalPriceSpan) {
        console.error('[Checkout.ts] Missing summary DOM elements.');
        return;
    }

    const token = getToken();
    if (!token) {
        orderSummaryItemsDiv.innerHTML = '<p>Please <a href="/login.html">login</a> to view your order summary.</p>';
        if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = true;
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
                removeToken();
                updateNavAndCart();
            }
            throw new Error('Failed to fetch cart summary.');
        }
        const cartResult = await response.json();
        const cartData = cartResult.data;
        console.log('[Checkout.ts] Cart summary data:', cartData);

        if (!cartData || !cartData.items || cartData.items.length === 0) {
            orderSummaryItemsDiv.innerHTML = '<p>Your cart is empty. <a href="/">Continue shopping</a>.</p>';
            summaryTotalPriceSpan.textContent = '0.00';
            if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = true;
            return;
        }

        orderSummaryItemsDiv.innerHTML = `
            <h4>Order Items:</h4>
            <ul>
                ${cartData.items.map((item: any) => `<li>${item.name || item.product?.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
            </ul>`;
        summaryTotalPriceSpan.textContent = cartData.totalPrice?.toFixed(2) || '0.00';
        if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = false;

    } catch (error: any) {
        console.error('[Checkout.ts] Error fetching cart summary:', error);
        orderSummaryItemsDiv.innerHTML = `<p>Error loading summary: ${error.message}</p>`;
        if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = true;
    }
}

async function handleConfirmOrderAndPay() {
    console.log('[Checkout.ts] handleConfirmOrderAndPay function initiated.');

    if (!checkoutMessageEl || !addressInput || !cityInput || !postalCodeInput || !countryInput || !paymentMethodSelect) {
        console.error('[Checkout.ts] Critical checkout form DOM elements are missing.');
        if(checkoutMessageEl) {
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
    const paymentMethod = paymentMethodSelect.value;

    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
        checkoutMessageEl.style.color = 'red';
        checkoutMessageEl.textContent = 'Please fill in all shipping address fields.';
        return;
    }

    checkoutMessageEl.style.color = 'blue';
    checkoutMessageEl.textContent = 'Processing order... Please wait.';
    if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = true;

    let createdOrderData: any = null;

    try {
        console.log('[Checkout.ts] Fetching current cart details to build orderItems...');
        const cartResponse = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!cartResponse.ok) {
            const cartError = await cartResponse.json().catch(() => ({ message: 'Failed to fetch current cart details before creating order.' }));
            throw new Error(cartError.message);
        }
        const cartResult = await cartResponse.json();
        const cartForOrder = cartResult.data;

        if (!cartForOrder || !cartForOrder.items || cartForOrder.items.length === 0) {
            throw new Error('Your cart is empty. Cannot create an order.');
        }

        console.log('[Checkout.ts] cartForOrder.items that will be mapped:', JSON.stringify(cartForOrder.items, null, 2));

        const orderItemsPayload = cartForOrder.items.map((item: any) => {
            console.log('[Checkout.ts] Processing cart item for order payload:', JSON.stringify(item, null, 2));
            const productId = (typeof item.product === 'object' && item.product !== null) ? item.product._id : item.product;
            console.log(`[Checkout.ts] Derived productId for item "${item.name || 'Unknown Name'}":`, productId);

            if (!productId) {
                console.error('[Checkout.ts] CRITICAL: productId is undefined for item:', item);
            }

            return {
                product: productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                image: item.image
            };
        });

        // Check if any productId was undefined during mapping
        // Add type to 'item' in the callback function for 'some'
        if (orderItemsPayload.some((item: { product: any }) => item.product === undefined)) { // <<<< CORRECTED THIS LINE
            console.error('[Checkout.ts] At least one item in orderItemsPayload has an undefined productId. Payload:', JSON.stringify(orderItemsPayload, null, 2));
            throw new Error('Failed to prepare order items: one or more product IDs are missing.');
        }
        console.log('[Checkout.ts] Constructed orderItemsPayload to be sent:', JSON.stringify(orderItemsPayload, null, 2));


        console.log('[Checkout.ts] Sending POST /api/v1/orders with orderItems...');
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                orderItems: orderItemsPayload,
                shippingAddress,
                paymentMethod
            })
        });
        const orderResult = await orderResponse.json();
        console.log('[Checkout.ts] Create order API response status:', orderResponse.status);
        console.log('[Checkout.ts] Create order API response data:', orderResult);

        if (!orderResponse.ok) {
            const errorDetail = orderResult.message || (orderResult.errors ? JSON.stringify(orderResult.errors) : `Failed to create order (Status: ${orderResponse.status})`);
            throw new Error(errorDetail);
        }

        createdOrderData = orderResult.data;

        if (!createdOrderData || !createdOrderData._id) {
            console.error('[Checkout.ts] Order data from backend is invalid or missing _id after creation!', createdOrderData);
            throw new Error('Internal error: Failed to process valid order creation response.');
        }

        checkoutMessageEl.textContent = `Order #${createdOrderData._id} created. Simulating payment...`;

        await new Promise(resolve => setTimeout(resolve, 2500));
        const paymentSuccess = Math.random() > 0.05;

        if (paymentSuccess) {
            checkoutMessageEl.textContent = 'Payment successful! Updating order status...';
            console.log('[Checkout.ts] TOKEN BEING USED FOR /pay ROUTE:', token ? 'Exists' : 'MISSING!');
            const payResponse = await fetch(`${API_BASE_URL}/orders/${createdOrderData._id}/pay`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const payResult = await payResponse.json();
            console.log('[Checkout.ts] Mark as paid API response:', payResult);

            if (!payResponse.ok) {
                throw new Error(payResult.message || 'Failed to update order to paid');
            }

            checkoutMessageEl.style.color = 'green';
            const updatedOrderAfterPayment = payResult.data;

            if (!updatedOrderAfterPayment || !updatedOrderAfterPayment.status) {
                throw new Error("Failed to get updated order status after payment.");
            }

            checkoutMessageEl.textContent = `Order #${createdOrderData._id} placed and payment successful! Status: ${updatedOrderAfterPayment.status}. You will be redirected shortly.`;

            updateNavAndCart();

            setTimeout(() => {
                alert(`Thank you for your order! Order ID: ${createdOrderData._id}`);
                window.location.href = '/';
            }, 3000);

        } else {
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = 'Simulated payment failed. Your order has been placed with "Pending Payment" status. Please contact support or try again later.';
            alert('Payment simulation failed. Your order was created but payment is pending.');
            if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = false;
        }

    } catch (error: any) {
        console.error('[Checkout.ts] Checkout process error:', error);
        checkoutMessageEl.style.color = 'red';
        checkoutMessageEl.textContent = `Error: ${error.message}`;
        if (confirmOrderPayBtn) confirmOrderPayBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Checkout.ts] DOMContentLoaded: Script is running.');

    updateNavAndCart();
    const token = getToken();
    if (!token) {
        console.log('[Checkout.ts] No token on DOMContentLoaded after nav update, redirecting to login.');
        return;
    }
    fetchCartSummaryForCheckout();

    console.log('[Checkout.ts] DOMContentLoaded: Confirm Order Button Element (confirmOrderPayBtn global):', confirmOrderPayBtn);
    if (confirmOrderPayBtn) {
        console.log('[Checkout.ts] DOMContentLoaded: Attaching click listener to confirm-order-pay-btn');
        confirmOrderPayBtn.addEventListener('click', handleConfirmOrderAndPay);
    } else {
        console.error('[Checkout.ts] DOMContentLoaded: ERROR - Confirm Order & Pay button (confirm-order-pay-btn) NOT FOUND in DOM!');
    }
});