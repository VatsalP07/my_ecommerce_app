// frontend/ts/productDetail.ts
import { API_BASE_URL, getToken, updateNavAndCart } from './main.js'; // Uses updateNavAndCart

const productDetailContainer = document.getElementById('product-detail-content');

async function handleAddToCart(productId: string | undefined) {
    if (!productId) {
        console.error('[productDetail.ts] Product ID is undefined for Add to Cart.');
        alert('Could not add to cart, product ID missing.');
        return;
    }
    const token = getToken();
    if (!token) {
        alert('Please login to add items to your cart.');
        const currentPath = window.location.pathname;
        const currentQuery = window.location.search;
        window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath + currentQuery)}`;
        return;
    }
    const messageEl = document.getElementById('add-to-cart-message');
    if (messageEl) messageEl.textContent = 'Adding...';
    console.log(`[productDetail.ts] Add to cart clicked for product ID: ${productId}`);
    try {
        const response = await fetch(`${API_BASE_URL}/cart/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ productId: productId, quantity: 1 })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to add to cart');
        if (messageEl) messageEl.textContent = 'Added to cart successfully!';
        console.log(`[productDetail.ts] Product added to cart. API response:`, result);
        updateNavAndCart(); // Update nav (which includes cart count)
        setTimeout(() => { if(messageEl) messageEl.textContent = ''; }, 3000);
    } catch (error: any) {
        console.error('[productDetail.ts] Add to cart error:', error);
        if (messageEl) messageEl.textContent = `Error: ${error.message}`;
    }
}

async function fetchProductDetail() {
    // ... (fetchProductDetail function as you provided, no changes needed here regarding updateNav) ...
    if (!productDetailContainer) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (!productId) { productDetailContainer.innerHTML = '<p>No product ID specified.</p>'; return; }
    productDetailContainer.innerHTML = '<p>Loading product details...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Product not found.');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        renderProductDetail(product);
    } catch (error: any) { /* ... */ }
}
function renderProductDetail(product: any) {
    // ... (renderProductDetail function as you provided, ensure it has addToCartBtn event listener logic) ...
    // Ensure the addToCartBtn listener calls handleAddToCart(product._id)
    if (!productDetailContainer) return;
    productDetailContainer.setAttribute('data-current-product-id', product._id);
    productDetailContainer.innerHTML = `
        <h2>${product.name}</h2>
        <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/300'}" alt="${product.name}" style="max-width: 300px; margin-bottom: 20px;">
        <p><strong>Description:</strong> ${product.description}</p>
        <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
        <p><strong>Category:</strong> ${product.category}</p>
        <p id="product-stock-display"><strong>Stock:</strong> ${product.stock > 0 ? product.stock : 'Out of Stock'}</p>
        <p><strong>Seller:</strong> ${product.sellerId?.name || 'N/A'}</p>
        ${product.stock > 0 ? `<button id="add-to-cart-btn" data-product-id="${product._id}">Add to Cart</button>` : '<p id="out-of-stock-message">Out of Stock</p>'}
        <div id="add-to-cart-message" style="margin-top:10px; color: green;"></div>
    `;
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => handleAddToCart(product._id));
    }
}
function updateStockOnDetailPage(productIdFromEvent: string, newStock: number) {
    // ... (updateStockOnDetailPage function as you provided) ...
}

document.addEventListener('stockUpdatedOnPage', (event: Event) => {
    // ... (stockUpdatedOnPage listener as you provided) ...
    const customEvent = event as CustomEvent<{ productId: string, newStock: number }>;
    if (customEvent.detail) {
        const { productId, newStock } = customEvent.detail;
        if (document.getElementById('product-detail-content')) {
            updateStockOnDetailPage(productId, newStock);
        }
    }
});

if (window.location.pathname.includes('/product-detail.html')) {
    fetchProductDetail();
}