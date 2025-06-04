// frontend/ts/productDetail.ts
import { API_BASE_URL, getToken, updateNavAndCart, escapeHtml } from './main.js'; // Added escapeHtml
const productDetailContainer = document.getElementById('product-detail-content');
// This function remains largely the same, just ensure quantity is handled if you add an input
async function handleAddToCart(productId, quantity = 1) {
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
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (messageEl) {
        messageEl.textContent = 'Adding to cart...';
        messageEl.className = 'mt-3 text-sm font-medium text-gray-600'; // Neutral message style
    }
    if (addToCartBtn)
        addToCartBtn.disabled = true;
    console.log(`[productDetail.ts] Add to cart clicked for product ID: ${productId}, Quantity: ${quantity}`);
    try {
        const response = await fetch(`${API_BASE_URL}/cart/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ productId: productId, quantity: quantity }) // Use passed quantity
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Failed to add to cart. Please try again.');
        }
        if (messageEl) {
            messageEl.textContent = 'Added to cart successfully!';
            messageEl.className = 'mt-3 text-sm font-medium text-green-600'; // Success message style
        }
        console.log(`[productDetail.ts] Product added to cart. API response:`, result);
        updateNavAndCart(); // Update nav (which includes cart count)
        setTimeout(() => { if (messageEl)
            messageEl.textContent = ''; }, 3000);
    }
    catch (error) {
        console.error('[productDetail.ts] Add to cart error:', error);
        if (messageEl) {
            messageEl.textContent = `Error: ${error.message}`;
            messageEl.className = 'mt-3 text-sm font-medium text-red-600'; // Error message style
        }
    }
    finally {
        if (addToCartBtn)
            addToCartBtn.disabled = false;
    }
}
async function fetchProductDetail() {
    if (!productDetailContainer)
        return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (!productId) {
        productDetailContainer.innerHTML = '<p class="text-center text-red-500">No product ID specified in URL.</p>';
        return;
    }
    // Update the #product-detail-content div (which is the container itself for this page's main content)
    productDetailContainer.innerHTML = `
        <div class="animate-pulse flex flex-col md:flex-row md:gap-8 lg:gap-12">
            <div class="md:w-1/2 lg:w-2/5">
                <div class="w-full h-80 md:h-96 bg-gray-300 rounded-lg shadow-lg mb-4"></div>
                <div class="flex space-x-2 overflow-x-auto">
                    <div class="w-20 h-20 bg-gray-300 rounded"></div>
                    <div class="w-20 h-20 bg-gray-300 rounded"></div>
                    <div class="w-20 h-20 bg-gray-300 rounded"></div>
                </div>
            </div>
            <div class="md:w-1/2 lg:w-3/5 mt-6 md:mt-0">
                <div class="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div class="h-8 bg-gray-300 rounded w-1/2 mb-3"></div>
                <div class="h-3 bg-gray-300 rounded w-1/3 mb-4"></div>
                <div class="h-10 bg-gray-300 rounded w-1/4 mb-6"></div>
                <div class="h-4 bg-gray-300 rounded w-1/4 mb-1"></div>
                <div class="space-y-2">
                    <div class="h-3 bg-gray-300 rounded w-full"></div>
                    <div class="h-3 bg-gray-300 rounded w-full"></div>
                    <div class="h-3 bg-gray-300 rounded w-5/6"></div>
                </div>
                <div class="h-4 bg-gray-300 rounded w-1/3 mt-6 mb-6"></div>
                <div class="h-12 bg-gray-300 rounded w-full mt-6"></div>
            </div>
        </div>
    `; // Basic skeleton loader
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404)
                throw new Error('Product not found.');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        renderProductDetail(product.data || product); // Handle if data is nested under 'data' key
    }
    catch (error) {
        console.error('[productDetail.ts] Failed to fetch product details:', error);
        if (productDetailContainer) {
            productDetailContainer.innerHTML = `<p class="text-center text-red-600">Error loading product: ${escapeHtml(error.message)}</p>`;
        }
    }
}
function renderProductDetail(product) {
    if (!productDetailContainer || !product) {
        if (productDetailContainer)
            productDetailContainer.innerHTML = '<p class="text-center text-red-500">Could not load product details.</p>';
        return;
    }
    productDetailContainer.setAttribute('data-current-product-id', product._id); // For stock updates
    // Image and Thumbnails (Simplified: shows first image, placeholder for thumbnails)
    let mainImageSrc = 'https://via.placeholder.com/600x600?text=No+Image';
    if (product.imageKeys && product.imageKeys.length > 0) {
        mainImageSrc = product.imageKeys[0];
    }
    // Placeholder for thumbnail logic - could be expanded
    let thumbnailsHTML = '';
    if (product.imageKeys && product.imageKeys.length > 1) {
        thumbnailsHTML = product.imageKeys.map((imgUrl, index) => `
            <img src="${escapeHtml(imgUrl)}" alt="Thumbnail ${index + 1}" 
                 class="w-20 h-20 object-cover rounded-md border-2 border-transparent hover:border-blue-500 cursor-pointer transition-all"
                 onclick="document.getElementById('main-product-image').src='${escapeHtml(imgUrl)}'">
        `).join('');
    }
    productDetailContainer.innerHTML = `
        <div class="md:flex md:gap-8 lg:gap-12">
            <div class="md:w-1/2 lg:w-2/5">
                <img id="main-product-image" src="${escapeHtml(mainImageSrc)}" alt="${escapeHtml(product.name)}" 
                     class="w-full h-auto max-h-[500px] object-contain rounded-lg shadow-lg mb-4 md:sticky md:top-28">
                ${thumbnailsHTML ? `<div id="thumbnail-images" class="flex space-x-2 overflow-x-auto pb-2">${thumbnailsHTML}</div>` : ''}
            </div>

            <div class="md:w-1/2 lg:w-3/5 mt-6 md:mt-0">
                <p id="product-category" class="text-sm text-gray-500 uppercase tracking-wider mb-1">${escapeHtml(product.category)}</p>
                <h1 id="product-name" class="text-3xl lg:text-4xl font-bold text-gray-900 mb-3 leading-tight">${escapeHtml(product.name)}</h1>
                <p id="product-seller" class="text-xs text-gray-500 mb-4">
                    Sold by: <span class="font-medium text-indigo-600">${escapeHtml(product.sellerId?.name || 'MyStore')}</span>
                </p>
                
                <p id="product-price" class="text-4xl font-bold text-indigo-600 mb-6">$${parseFloat(product.price).toFixed(2)}</p>
                
                <div class="mb-6">
                    <h3 class="text-md font-semibold text-gray-800 mb-2 border-b pb-1">Description</h3>
                    <div id="product-description" class="text-gray-700 leading-relaxed prose prose-sm max-w-none">
                        ${escapeHtml(product.description).replace(/\n/g, '<br>')}
                    </div>
                </div>

                <p id="product-stock" class="stock-info-detail text-sm font-semibold mb-6 
                           ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}">
                    <span class="inline-block w-2.5 h-2.5 ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2 align-middle"></span>
                    ${product.stock > 0 ? `${product.stock} In Stock` : 'Out of Stock'}
                </p>
                
                <div id="purchase-actions" class="mt-6">
                    ${product.stock > 0 ? `
                        <div class="flex items-center space-x-3 mb-4">
                            <label for="quantity-input" class="text-sm font-medium text-gray-700">Quantity:</label>
                            <input type="number" id="quantity-input" value="1" min="1" max="${product.stock}" 
                                   class="w-20 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-center focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <button id="add-to-cart-btn" 
                                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75">
                            Add to Cart
                        </button>
                    ` : `
                        <p id="out-of-stock-message" class="text-red-600 font-semibold text-lg">Currently Out of Stock</p>
                        <button class="w-full bg-gray-300 text-gray-500 font-bold py-3 px-6 rounded-lg text-lg cursor-not-allowed mt-4" disabled>
                            Out of Stock
                        </button>
                    `}
                </div>
                <div id="add-to-cart-message" class="mt-4 text-sm font-medium"></div>
            </div>
        </div>
    `;
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            const quantityInput = document.getElementById('quantity-input');
            const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
            handleAddToCart(product._id, quantity > 0 ? quantity : 1);
        });
    }
}
function updateStockOnDetailPage(productIdFromEvent, newStock) {
    const currentProductId = productDetailContainer?.dataset.currentProductId;
    if (currentProductId === productIdFromEvent) {
        const stockElement = document.getElementById('product-stock');
        const purchaseActionsDiv = document.getElementById('purchase-actions');
        const addToCartBtn = document.getElementById('add-to-cart-btn'); // For re-finding if recreated
        if (stockElement) {
            stockElement.innerHTML = `
                <span class="inline-block w-2.5 h-2.5 ${newStock > 0 ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2 align-middle"></span>
                ${newStock > 0 ? `${newStock} In Stock` : 'Out of Stock'}
            `;
            stockElement.className = `stock-info-detail text-sm font-semibold mb-6 ${newStock > 0 ? 'text-green-600' : 'text-red-600'}`;
        }
        if (purchaseActionsDiv) {
            if (newStock > 0) {
                // If 'Add to Cart' button and quantity input don't exist, create them
                if (!document.getElementById('add-to-cart-btn')) {
                    purchaseActionsDiv.innerHTML = `
                        <div class="flex items-center space-x-3 mb-4">
                            <label for="quantity-input" class="text-sm font-medium text-gray-700">Quantity:</label>
                            <input type="number" id="quantity-input" value="1" min="1" max="${newStock}" 
                                   class="w-20 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-center focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <button id="add-to-cart-btn" 
                                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75">
                            Add to Cart
                        </button>
                    `;
                    // Re-attach event listener to the newly created button
                    const newAddToCartBtn = document.getElementById('add-to-cart-btn');
                    if (newAddToCartBtn) {
                        newAddToCartBtn.addEventListener('click', () => {
                            const quantityInput = document.getElementById('quantity-input');
                            const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
                            handleAddToCart(currentProductId, quantity > 0 ? quantity : 1);
                        });
                    }
                }
                else {
                    // Update existing quantity input max stock and button state
                    const quantityInput = document.getElementById('quantity-input');
                    if (quantityInput)
                        quantityInput.max = newStock.toString();
                    const currentAddToCartBtn = document.getElementById('add-to-cart-btn');
                    if (currentAddToCartBtn)
                        currentAddToCartBtn.disabled = false;
                }
                const outOfStockMsg = document.getElementById('out-of-stock-message');
                if (outOfStockMsg)
                    outOfStockMsg.remove();
            }
            else { // Out of stock
                purchaseActionsDiv.innerHTML = `
                    <p id="out-of-stock-message" class="text-red-600 font-semibold text-lg">Currently Out of Stock</p>
                    <button class="w-full bg-gray-300 text-gray-500 font-bold py-3 px-6 rounded-lg text-lg cursor-not-allowed mt-4" disabled>
                        Out of Stock
                    </button>
                `;
            }
        }
    }
}
document.addEventListener('stockUpdatedOnPage', (event) => {
    const customEvent = event;
    if (customEvent.detail) {
        const { productId, newStock } = customEvent.detail;
        // Ensure we are on a product detail page by checking for the main container
        if (document.getElementById('product-detail-content')) {
            updateStockOnDetailPage(productId, newStock);
        }
    }
});
if (window.location.pathname.includes('/product-detail.html')) {
    updateNavAndCart(); // Call this to ensure nav is updated when directly landing on page
    fetchProductDetail();
}
