// frontend/ts/productDetail.ts
import { API_BASE_URL, getToken, updateCartCount } from './main.js'; // Adjust path if needed
const productDetailContainer = document.getElementById('product-detail-content');
// --- Helper Function for Add to Cart Logic ---
async function handleAddToCart(productId) {
    if (!productId) {
        console.error('[productDetail.ts] Product ID is undefined for Add to Cart.');
        alert('Could not add to cart, product ID missing.');
        return;
    }
    const token = getToken();
    if (!token) {
        alert('Please login to add items to your cart.');
        // Construct the redirect URL carefully to return to the current product page
        const currentPath = window.location.pathname;
        const currentQuery = window.location.search; // Includes the ?id=... part
        window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath + currentQuery)}`;
        return;
    }
    const messageEl = document.getElementById('add-to-cart-message');
    if (messageEl)
        messageEl.textContent = 'Adding...';
    console.log(`[productDetail.ts] Add to cart clicked for product ID: ${productId}`);
    try {
        const response = await fetch(`${API_BASE_URL}/cart/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId: productId, quantity: 1 })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Failed to add to cart');
        }
        if (messageEl)
            messageEl.textContent = 'Added to cart successfully!';
        console.log(`[productDetail.ts] Product added to cart. API response:`, result);
        updateCartCount(); // Update cart count in nav
        setTimeout(() => { if (messageEl)
            messageEl.textContent = ''; }, 3000);
    }
    catch (error) {
        console.error('[productDetail.ts] Add to cart error:', error);
        if (messageEl)
            messageEl.textContent = `Error: ${error.message}`;
    }
}
// --- Fetch and Render Product Detail ---
async function fetchProductDetail() {
    if (!productDetailContainer)
        return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (!productId) {
        productDetailContainer.innerHTML = '<p>No product ID specified.</p>';
        return;
    }
    productDetailContainer.innerHTML = '<p>Loading product details...</p>';
    console.log(`[productDetail.ts] Fetching details for product ID: ${productId}`);
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404)
                throw new Error('Product not found.');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        console.log(`[productDetail.ts] Product details fetched:`, product);
        renderProductDetail(product);
    }
    catch (error) {
        console.error('[productDetail.ts] Failed to fetch product details:', error);
        productDetailContainer.innerHTML = `<p>Error loading product: ${error.message}</p>`;
    }
}
function renderProductDetail(product) {
    if (!productDetailContainer)
        return;
    // Store current product ID on the container for easy access by stock update logic
    productDetailContainer.setAttribute('data-current-product-id', product._id);
    productDetailContainer.innerHTML = `
        <h2>${product.name}</h2>
        <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/300'}" alt="${product.name}" style="max-width: 300px; margin-bottom: 20px;">
        <p><strong>Description:</strong> ${product.description}</p>
        <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
        <p><strong>Category:</strong> ${product.category}</p>
        <!-- Corrected HTML comment -->
        <!-- Added id for specific stock element -->
        <p id="product-stock-display"><strong>Stock:</strong> ${product.stock > 0 ? product.stock : 'Out of Stock'}</p>
        <p><strong>Seller:</strong> ${product.sellerId?.name || 'N/A'}</p>
        ${product.stock > 0 ? `<button id="add-to-cart-btn" data-product-id="${product._id}">Add to Cart</button>` : '<p id="out-of-stock-message">Out of Stock</p>'}
        <div id="add-to-cart-message" style="margin-top:10px; color: green;"></div>
    `;
    console.log(`[productDetail.ts] Product detail rendered for ID: ${product._id}`);
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => handleAddToCart(product._id));
    }
}
// --- Real-time Stock Update Logic ---
function updateStockOnDetailPage(productIdFromEvent, newStock) {
    console.log(`[productDetail.ts] Attempting to update stock for product ${productIdFromEvent} to ${newStock} on detail page.`);
    if (!productDetailContainer)
        return;
    const currentProductIdOnPage = productDetailContainer.getAttribute('data-current-product-id');
    if (currentProductIdOnPage === productIdFromEvent) {
        const stockElement = document.getElementById('product-stock-display');
        let addToCartBtn = document.getElementById('add-to-cart-btn');
        let outOfStockMessageEl = document.getElementById('out-of-stock-message');
        // Update stock display text
        if (stockElement) {
            stockElement.innerHTML = `<strong>Stock:</strong> ${newStock > 0 ? newStock : 'Out of Stock'}`;
            console.log(`[productDetail.ts] Stock display updated for product ${productIdFromEvent}.`);
        }
        // Manage Add to Cart button and Out of Stock message visibility
        if (newStock > 0) {
            // If "Out of Stock" message exists, remove it
            if (outOfStockMessageEl) {
                outOfStockMessageEl.remove();
                outOfStockMessageEl = null; // Clear reference
            }
            // If "Add to Cart" button doesn't exist (was previously out of stock), create and insert it
            if (!addToCartBtn) {
                const newBtn = document.createElement('button');
                newBtn.id = 'add-to-cart-btn';
                newBtn.dataset.productId = productIdFromEvent; // Use the ID from the event
                newBtn.textContent = 'Add to Cart';
                newBtn.addEventListener('click', () => handleAddToCart(productIdFromEvent)); // Attach listener
                // Find a suitable place to insert the button
                // Attempt to insert after seller info, before the "add-to-cart-message" div
                const sellerInfoP = Array.from(productDetailContainer.getElementsByTagName('p')).find(p => p.textContent?.startsWith('Seller:'));
                const messageDiv = document.getElementById('add-to-cart-message');
                if (sellerInfoP && messageDiv) {
                    sellerInfoP.insertAdjacentElement('afterend', newBtn);
                }
                else if (messageDiv) { // Fallback if seller info not found
                    productDetailContainer.insertBefore(newBtn, messageDiv);
                }
                else { // Fallback if messageDiv also not found
                    productDetailContainer.appendChild(newBtn);
                }
                addToCartBtn = newBtn; // Update reference to the new button
            }
            // Ensure the button (either existing or newly created) is enabled and visible
            if (addToCartBtn) {
                addToCartBtn.disabled = false;
                addToCartBtn.style.display = ''; // Ensure it's visible if previously hidden
                addToCartBtn.textContent = 'Add to Cart';
            }
        }
        else { // Stock is 0 or less
            // If "Add to Cart" button exists, hide or disable it
            if (addToCartBtn) {
                // addToCartBtn.disabled = true;
                // addToCartBtn.textContent = 'Out of Stock';
                addToCartBtn.style.display = 'none'; // Hide the button
            }
            // If "Out of Stock" message doesn't exist, create and insert it
            if (!outOfStockMessageEl) {
                outOfStockMessageEl = document.createElement('p');
                outOfStockMessageEl.id = 'out-of-stock-message';
                outOfStockMessageEl.textContent = 'Out of Stock';
                const sellerInfoP = Array.from(productDetailContainer.getElementsByTagName('p')).find(p => p.textContent?.startsWith('Seller:'));
                const messageDiv = document.getElementById('add-to-cart-message');
                const existingAddToCartButton = document.getElementById('add-to-cart-btn'); // Check if button exists even if hidden
                // Try to insert after seller, before message div, or after button if it exists
                if (sellerInfoP && (existingAddToCartButton || messageDiv)) {
                    // If button exists (even hidden), insert after it. Else, insert before messageDiv
                    const referenceNode = existingAddToCartButton || messageDiv;
                    if (referenceNode) {
                        referenceNode.insertAdjacentElement('beforebegin', outOfStockMessageEl);
                    }
                    else {
                        sellerInfoP.insertAdjacentElement('afterend', outOfStockMessageEl);
                    }
                }
                else if (messageDiv) {
                    productDetailContainer.insertBefore(outOfStockMessageEl, messageDiv);
                }
                else {
                    productDetailContainer.appendChild(outOfStockMessageEl);
                }
            }
            if (outOfStockMessageEl) {
                outOfStockMessageEl.style.display = ''; // Ensure it's visible
            }
        }
        console.log(`[productDetail.ts] Add to Cart button/message state updated for product ${productIdFromEvent}.`);
    }
    else {
        // console.log(`[productDetail.ts] Stock update for ${productIdFromEvent} ignored, current page is for ${currentProductIdOnPage}.`);
    }
}
// Listen for the custom browser event dispatched from main.ts
document.addEventListener('stockUpdatedOnPage', (event) => {
    const customEvent = event;
    if (customEvent.detail) { // Ensure detail exists
        const { productId, newStock } = customEvent.detail;
        console.log(`[productDetail.ts] Received 'stockUpdatedOnPage' event for product ${productId}, new stock: ${newStock}`);
        // Only update if this page is active and showing product details
        if (document.getElementById('product-detail-content')) { // A simple check
            updateStockOnDetailPage(productId, newStock);
        }
    }
});
// Initial load for product detail page
if (window.location.pathname.includes('/product-detail.html')) {
    console.log(`[productDetail.ts] Initializing product detail page.`);
    fetchProductDetail();
}
