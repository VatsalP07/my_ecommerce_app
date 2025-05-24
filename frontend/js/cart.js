// frontend/ts/cart.ts
import { API_BASE_URL, getToken, updateCartCount, updateNav, removeToken } from './main.js';
const cartItemsContainer = document.getElementById('cart-items-container');
const totalItemsSpan = document.getElementById('total-items');
const totalPriceSpan = document.getElementById('total-price');
const clearCartButton = document.getElementById('clear-cart-button');
const checkoutButton = document.getElementById('checkout-button');
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
        return;
    }
    cartItemsContainer.innerHTML = '<p>Loading cart...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) { // Unauthorized, token might be bad
                removeToken();
                updateNav(); // Update nav to show login links
                fetchCart(); // Re-call to show login message
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        renderCart(result.data);
    }
    catch (error) {
        console.error('Failed to fetch cart:', error);
        cartItemsContainer.innerHTML = `<p>Error loading cart: ${error.message}</p>`;
    }
}
function renderCart(cart) {
    if (!cartItemsContainer || !totalItemsSpan || !totalPriceSpan)
        return;
    if (!cart || !cart.items || cart.items.length === 0) {
        cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
        totalItemsSpan.textContent = '0';
        totalPriceSpan.textContent = '0.00';
        if (clearCartButton)
            clearCartButton.disabled = true;
        if (checkoutButton)
            checkoutButton.disabled = true;
        return;
    }
    if (clearCartButton)
        clearCartButton.disabled = false;
    if (checkoutButton)
        checkoutButton.disabled = false;
    cartItemsContainer.innerHTML = cart.items.map((item) => `
        <div class="cart-item" data-cart-item-id="${item._id}">
            <img src="${item.image || (item.product?.imageKeys && item.product.imageKeys.length > 0 ? item.product.imageKeys[0] : 'https://via.placeholder.com/50')}" alt="${item.name || item.product?.name}">
            <div>
                <strong>${item.name || item.product?.name}</strong><br>
                Price: $${item.price.toFixed(2)}
            </div>
            <div>
                Quantity:
                <input type="number" class="item-quantity-input" value="${item.quantity}" min="1" data-product-stock="${item.product?.stock || 999}" style="width: 60px;">
            </div>
            <div>Subtotal: $${(item.quantity * item.price).toFixed(2)}</div>
            <button class="remove-item-btn">Remove</button>
        </div>
    `).join('');
    totalItemsSpan.textContent = cart.totalQuantity?.toString() || '0';
    totalPriceSpan.textContent = cart.totalPrice?.toFixed(2) || '0.00';
    // Add event listeners for quantity changes and remove buttons
    document.querySelectorAll('.item-quantity-input').forEach(input => {
        input.addEventListener('change', handleQuantityChange);
    });
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', handleRemoveItem);
    });
}
async function handleQuantityChange(event) {
    const input = event.target;
    const cartItemDiv = input.closest('.cart-item');
    const cartItemId = cartItemDiv.dataset.cartItemId;
    const newQuantity = parseInt(input.value);
    const maxStock = parseInt(input.dataset.productStock || "999");
    if (isNaN(newQuantity) || newQuantity < 1) {
        alert('Quantity must be at least 1.');
        fetchCart(); // Re-fetch to reset to valid state
        return;
    }
    if (newQuantity > maxStock) {
        alert(`Cannot exceed available stock (${maxStock}).`);
        input.value = maxStock.toString(); // Reset to max stock
        // Optionally, you could proceed with maxStock or just show error and re-fetch
        // For now, let's just correct the input and let user confirm.
        return; // Or call update API with maxStock
    }
    if (!cartItemId)
        return;
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
        if (!response.ok) {
            throw new Error(result.message || 'Failed to update quantity');
        }
        renderCart(result.data); // Re-render cart with updated data
        updateCartCount();
    }
    catch (error) {
        console.error('Update quantity error:', error);
        alert(`Error: ${error.message}`);
        fetchCart(); // Re-fetch to ensure UI consistency
    }
}
async function handleRemoveItem(event) {
    const button = event.target;
    const cartItemDiv = button.closest('.cart-item');
    const cartItemId = cartItemDiv.dataset.cartItemId;
    if (!cartItemId || !confirm('Are you sure you want to remove this item?'))
        return;
    try {
        const response = await fetch(`${API_BASE_URL}/cart/items/${cartItemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Failed to remove item');
        }
        renderCart(result.data);
        updateCartCount();
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
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.message || 'Failed to clear cart');
            renderCart(result.data);
            updateCartCount();
        }
        catch (error) {
            console.error('Clear cart error:', error);
            alert(`Error: ${error.message}`);
        }
    });
}
if (checkoutButton) {
    checkoutButton.addEventListener('click', () => {
        alert('Checkout process not yet implemented!');
        // Later, this would redirect to a checkout page or start a payment flow
    });
}
// Initial load for cart page
if (window.location.pathname.includes('/cart.html')) {
    fetchCart();
}
//# sourceMappingURL=cart.js.map