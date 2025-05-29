import { API_BASE_URL, getToken, removeToken, updateNavAndCart } from './main.js'; // Uses updateNavAndCart
const cartItemsContainer = document.getElementById('cart-items-container');
const totalItemsSpan = document.getElementById('total-items');
const totalPriceSpan = document.getElementById('total-price');
const clearCartButton = document.getElementById('clear-cart-button');
const checkoutButton = document.getElementById('checkout-button'); // Main checkout button
const placeOrderTestBtn = document.getElementById('place-order-test-btn'); // Your specific test button from cart.html
const checkoutMessageEl = document.getElementById('checkout-message') || document.createElement('p');
if (document.getElementById('checkout-message') === null && (checkoutButton || placeOrderTestBtn)) {
    (checkoutButton?.parentElement || placeOrderTestBtn?.parentElement)?.appendChild(checkoutMessageEl);
}
async function fetchCart() {
    if (!cartItemsContainer || !totalItemsSpan || !totalPriceSpan)
        return;
    const token = getToken();
    if (!token) {
        cartItemsContainer.innerHTML = '<p>Please <a href="/login.html?redirect=/cart.html">login</a> to view your cart.</p>';
        totalItemsSpan.textContent = '0';
        totalPriceSpan.textContent = '0.00';
        if (clearCartButton)
            clearCartButton.disabled = true;
        if (checkoutButton)
            checkoutButton.disabled = true;
        if (placeOrderTestBtn)
            placeOrderTestBtn.disabled = true;
        return;
    }
    cartItemsContainer.innerHTML = '<p>Loading cart...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) {
            if (response.status === 401) {
                console.log('[DEBUG Cart Page]: Received 401 from /cart on fetchCart. Removing token and updating nav.');
                removeToken();
                updateNavAndCart();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        renderCart(result.data);
    }
    catch (error) {
        console.error('[cart.ts] Failed to fetch cart:', error);
        cartItemsContainer.innerHTML = `<p>Error loading cart: ${error.message}</p>`;
    }
}
function renderCart(cart) {
    if (!cartItemsContainer || !totalItemsSpan || !totalPriceSpan)
        return;
    const hasItems = cart && cart.items && cart.items.length > 0;
    if (!hasItems) {
        cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
        totalItemsSpan.textContent = '0';
        totalPriceSpan.textContent = '0.00';
        if (clearCartButton)
            clearCartButton.disabled = true;
        if (checkoutButton)
            checkoutButton.disabled = true;
        if (placeOrderTestBtn)
            placeOrderTestBtn.disabled = true;
        return;
    }
    if (clearCartButton)
        clearCartButton.disabled = false;
    if (checkoutButton)
        checkoutButton.disabled = false;
    if (placeOrderTestBtn)
        placeOrderTestBtn.disabled = false;
    cartItemsContainer.innerHTML = cart.items.map((item) => `
        <div class="cart-item" data-cart-item-id="${item._id}">
            <img src="${item.image || (item.product?.imageKeys && item.product.imageKeys.length > 0 ? item.product.imageKeys[0] : 'https://via.placeholder.com/50')}" alt="${item.name || item.product?.name}">
            <div><strong>${item.name || item.product?.name}</strong><br>Price: $${item.price.toFixed(2)}</div>
            <div>Quantity: <input type="number" class="item-quantity-input" value="${item.quantity}" min="1" data-product-stock="${item.product?.stock || 999}" style="width: 60px;"></div>
            <div>Subtotal: $${(item.quantity * item.price).toFixed(2)}</div>
            <button class="remove-item-btn">Remove</button>
        </div>
    `).join('');
    totalItemsSpan.textContent = cart.totalQuantity?.toString() || '0';
    totalPriceSpan.textContent = cart.totalPrice?.toFixed(2) || '0.00';
    document.querySelectorAll('.item-quantity-input').forEach(input => input.addEventListener('change', handleQuantityChange));
    document.querySelectorAll('.remove-item-btn').forEach(button => button.addEventListener('click', handleRemoveItem));
}
async function handleQuantityChange(event) {
    const input = event.target;
    const cartItemDiv = input.closest('.cart-item');
    const cartItemId = cartItemDiv?.dataset.cartItemId; // Added optional chaining
    const newQuantity = parseInt(input.value);
    const maxStock = parseInt(input.dataset.productStock || "999");
    if (isNaN(newQuantity) || newQuantity < 1) {
        alert('Quantity must be at least 1.');
        fetchCart();
        return;
    }
    if (newQuantity > maxStock) {
        alert(`Cannot exceed available stock (${maxStock}).`);
        input.value = maxStock.toString();
        return;
    }
    if (!cartItemId) {
        console.error("Cart item ID not found for quantity change.");
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/cart/items/${cartItemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ quantity: newQuantity })
        });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.message || 'Failed to update quantity');
        renderCart(result.data);
        updateNavAndCart();
    }
    catch (error) {
        console.error('Update quantity error:', error);
        alert(`Error: ${error.message}`);
        fetchCart();
    }
}
async function handleRemoveItem(event) {
    const button = event.target;
    const cartItemDiv = button.closest('.cart-item');
    const cartItemId = cartItemDiv?.dataset.cartItemId; // Added optional chaining
    if (!cartItemId || !confirm('Are you sure you want to remove this item?'))
        return;
    try {
        const response = await fetch(`${API_BASE_URL}/cart/items/${cartItemId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.message || 'Failed to remove item');
        renderCart(result.data);
        updateNavAndCart();
    }
    catch (error) {
        console.error('Remove item error:', error);
        alert(`Error: ${error.message}`);
        fetchCart();
    }
}
if (clearCartButton) {
    clearCartButton.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear your entire cart?'))
            return;
        try {
            const response = await fetch(`${API_BASE_URL}/cart`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.message || 'Failed to clear cart');
            renderCart(result.data);
            updateNavAndCart();
        }
        catch (error) {
            console.error('Clear cart error:', error);
            alert(`Error: ${error.message}`);
        }
    });
}
// This listener is for the button with id="checkout-button" in cart.html
// It navigates to checkout.html
if (checkoutButton) {
    checkoutButton.addEventListener('click', () => {
        const token = getToken();
        if (!token) {
            alert('Please login to proceed to checkout.');
            window.location.href = `/login.html?redirect=/cart.html`;
            return;
        }
        const currentTotalItems = parseInt(totalItemsSpan?.textContent || '0');
        if (currentTotalItems === 0) {
            alert('Your cart is empty. Please add items before proceeding to checkout.');
            return;
        }
        window.location.href = '/checkout.html';
    });
}
// This listener is for a button with id="place-order-test-btn" if it exists on cart.html
// This was the Day 12 simulated payment button.
if (placeOrderTestBtn) {
    placeOrderTestBtn.addEventListener('click', async () => {
        const token = getToken();
        if (!token) {
            alert('Please login to place an order.');
            return;
        }
        if (!confirm('Confirm your order details and proceed to simulated payment?'))
            return;
        if (checkoutMessageEl)
            checkoutMessageEl.textContent = 'Creating order...';
        let createdOrderData = null;
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
            if (!orderResponse.ok)
                throw new Error(orderResult.message || 'Failed to create order');
            createdOrderData = orderResult.data;
            if (checkoutMessageEl)
                checkoutMessageEl.textContent = `Order #${createdOrderData._id} created. Simulating payment...`;
            await new Promise(resolve => setTimeout(resolve, 2500));
            const paymentSuccess = Math.random() > 0.1;
            if (paymentSuccess) {
                if (checkoutMessageEl)
                    checkoutMessageEl.textContent = 'Payment successful! Updating order status...';
                const payResponse = await fetch(`${API_BASE_URL}/orders/${createdOrderData._id}/pay`, {
                    method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
                });
                const payResult = await payResponse.json();
                if (!payResponse.ok)
                    throw new Error(payResult.message || 'Failed to update order to paid');
                alert(`Order #${createdOrderData._id} placed and payment successful! Status: ${payResult.data.status}`);
                fetchCart();
                updateNavAndCart();
                if (checkoutMessageEl)
                    checkoutMessageEl.textContent = '';
                // window.location.href = `/order-confirmation.html?orderId=${createdOrderData._id}`;
            }
            else {
                if (checkoutMessageEl)
                    checkoutMessageEl.textContent = 'Simulated payment failed. Your order was created but payment is pending.';
                alert('Payment simulation failed. Your order was created but payment is pending.');
            }
        }
        catch (error) {
            console.error('Place order test error:', error);
            if (checkoutMessageEl)
                checkoutMessageEl.textContent = `Error: ${error.message}`;
            alert(`Checkout Error: ${error.message}`);
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    console.log('[cart.ts] DOMContentLoaded, calling updateNavAndCart and fetchCart.');
    updateNavAndCart();
    fetchCart(); // fetchCart is called within updateNavAndCart if token exists, or directly after if needed
});
