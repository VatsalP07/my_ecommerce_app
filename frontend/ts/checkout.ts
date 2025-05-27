// frontend/ts/checkout.ts
import { API_BASE_URL, getToken, updateCartCount, updateNav, removeToken } from './main.js';

const orderSummaryItemsDiv = document.getElementById('order-summary-items');
const summaryTotalPriceSpan = document.getElementById('summary-total-price');
const confirmOrderPayBtn = document.getElementById('confirm-order-pay-btn'); // Declared globally
const checkoutMessageEl = document.getElementById('checkout-message');

// Shipping Address Inputs
const addressInput = document.getElementById('address') as HTMLInputElement | null;
const cityInput = document.getElementById('city') as HTMLInputElement | null;
const postalCodeInput = document.getElementById('postalCode') as HTMLInputElement | null;
const countryInput = document.getElementById('country') as HTMLInputElement | null;
const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement | null;


async function fetchCartSummaryForCheckout() {
    if (!orderSummaryItemsDiv || !summaryTotalPriceSpan) return;

    const token = getToken();
    if (!token) {
        alert('Please login to proceed with checkout.');
        window.location.href = `/login.html?redirect=/checkout.html`;
        return;
    }

    orderSummaryItemsDiv.innerHTML = '<p>Loading cart summary...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) { removeToken(); updateNav(); }
            throw new Error('Failed to fetch cart summary.');
        }
        const cartResult = await response.json();
        const cartData = cartResult.data; // Assuming /cart endpoint returns { data: cartObject }

        if (!cartData || !cartData.items || cartData.items.length === 0) {
            orderSummaryItemsDiv.innerHTML = '<p>Your cart is empty. <a href="/">Continue shopping</a>.</p>';
            summaryTotalPriceSpan.textContent = '0.00';
            if (confirmOrderPayBtn) (confirmOrderPayBtn as HTMLButtonElement).disabled = true;
            return;
        }

        orderSummaryItemsDiv.innerHTML = `
            <ul>
                ${cartData.items.map((item: any) => `<li>${item.name || item.product?.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
            </ul>`;
        summaryTotalPriceSpan.textContent = cartData.totalPrice?.toFixed(2) || '0.00';
        if (confirmOrderPayBtn) (confirmOrderPayBtn as HTMLButtonElement).disabled = false;

    } catch (error: any) {
        console.error('Error fetching cart summary:', error);
        orderSummaryItemsDiv.innerHTML = `<p>Error loading summary: ${error.message}</p>`;
    }
}

async function handleConfirmOrderAndPay() {
    console.log('handleConfirmOrderAndPay FUNCTION EXECUTED'); // For debugging

    if (!checkoutMessageEl || !addressInput || !cityInput || !postalCodeInput || !countryInput || !paymentMethodSelect) {
        console.error('One or more checkout DOM elements are missing INSIDE handleConfirmOrderAndPay.');
        return;
    }

    const token = getToken();
    if (!token) {
        alert('Authentication session expired. Please login again.');
        window.location.href = `/login.html?redirect=/checkout.html`;
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
    if (confirmOrderPayBtn) (confirmOrderPayBtn as HTMLButtonElement).disabled = true;

    let createdOrderData: any = null;

    try {
        // --- Step 0: Fetch current cart items to send to backend ---
        const cartResponse = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!cartResponse.ok) {
            const cartError = await cartResponse.json().catch(() => ({ message: 'Failed to fetch cart details for order.' }));
            throw new Error(cartError.message);
        }
        const cartResult = await cartResponse.json();
        const cartData = cartResult.data; 

        if (!cartData || !cartData.items || cartData.items.length === 0) {
            throw new Error('Your cart is empty. Cannot create an order.');
        }

        const clientOrderItems = cartData.items.map((item: any) => ({
            productId: (item.product as any)?._id || item.product,
            quantity: item.quantity
        }));
        // --- End of Step 0 ---

        // 1. Create Order (now sending clientOrderItems)
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                orderItems: clientOrderItems, 
                shippingAddress,
                paymentMethod
            })
        });
        const orderResult = await orderResponse.json(); 

        if (!orderResponse.ok) {
            const errorDetail = orderResult.message || (orderResult.errors ? orderResult.errors.join(', ') : 'Failed to create order');
            throw new Error(errorDetail);
        }
        
        createdOrderData = orderResult; 
        
        if (!createdOrderData || !createdOrderData._id) { 
            console.error('Order data from backend is invalid or missing _id after creation!', createdOrderData);
            throw new Error('Internal error: Failed to process valid order creation response.');
        }
        
        checkoutMessageEl.textContent = `Order #${createdOrderData._id} created. Simulating payment...`;

        // 2. Simulate Payment Delay & Outcome
        await new Promise(resolve => setTimeout(resolve, 3000));
        const paymentSuccess = Math.random() > 0.05;

        if (paymentSuccess) {
            checkoutMessageEl.textContent = 'Payment successful! Updating order status...';
            // 3. Mark Order as Paid
            console.log('TOKEN BEING USED FOR /pay ROUTE:', token); // <<< --- ADD THIS LINE

            const payResponse = await fetch(`${API_BASE_URL}/orders/${createdOrderData._id}/pay`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const payResult = await payResponse.json(); 
            if (!payResponse.ok) {
                throw new Error(payResult.message || 'Failed to update order to paid');
            }

            checkoutMessageEl.style.color = 'green';
            const updatedOrderAfterPayment = payResult.data; // Assuming backend /pay responds with { data: order }
            
            if (!updatedOrderAfterPayment || !updatedOrderAfterPayment.status) {
                throw new Error("Failed to get updated order status after payment.");
            }

            checkoutMessageEl.textContent = `Order #${createdOrderData._id} placed and payment successful! Status: ${updatedOrderAfterPayment.status}. You will be redirected shortly.`;
            updateCartCount();

            setTimeout(() => {
                alert(`Thank you for your order! Order ID: ${createdOrderData._id}`);
                window.location.href = '/';
            }, 3000);

        } else {
            checkoutMessageEl.style.color = 'red';
            checkoutMessageEl.textContent = 'Simulated payment failed. Your order has been placed with "Pending Payment" status. Please contact support or try again later.';
            if (confirmOrderPayBtn) (confirmOrderPayBtn as HTMLButtonElement).disabled = false;
        }

    } catch (error: any) {
        console.error('Checkout process error:', error);
        checkoutMessageEl.style.color = 'red';
        checkoutMessageEl.textContent = `Error: ${error.message}`;
        if (confirmOrderPayBtn) (confirmOrderPayBtn as HTMLButtonElement).disabled = false;
    }
}

// Initial Setup on Page Load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Checkout DOMContentLoaded: Script is running.'); // For debugging

    updateNav();
    const token = getToken();
    if (!token) {
        alert('Please login to proceed with checkout.');
        window.location.href = `/login.html?redirect=/checkout.html`;
        return; 
    }
    fetchCartSummaryForCheckout();

    // --- Corrected Event Listener Attachment ---
    // confirmOrderPayBtn is already declared as a global const at the top of this file
    console.log('Checkout DOMContentLoaded: Confirm Order Button Element (confirmOrderPayBtn global):', confirmOrderPayBtn); 

    if (confirmOrderPayBtn) { 
        console.log('Checkout DOMContentLoaded: Attaching click listener to confirm-order-pay-btn'); 
        confirmOrderPayBtn.addEventListener('click', handleConfirmOrderAndPay);
    } else {
        console.error('Checkout DOMContentLoaded: ERROR - Confirm Order & Pay button (confirmOrderPayBtn global) NOT FOUND in DOM!'); 
    }
    // --- End of Correction ---
});