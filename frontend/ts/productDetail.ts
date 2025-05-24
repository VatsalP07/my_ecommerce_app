// frontend/ts/productDetail.ts
import { API_BASE_URL, getToken, updateCartCount } from './main.js';

const productDetailContainer = document.getElementById('product-detail-content');

async function fetchProductDetail() {
    if (!productDetailContainer) return;

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        productDetailContainer.innerHTML = '<p>No product ID specified.</p>';
        return;
    }

    productDetailContainer.innerHTML = '<p>Loading product details...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Product not found.');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        renderProductDetail(product);
    } catch (error: any) {
        console.error('Failed to fetch product details:', error);
        productDetailContainer.innerHTML = `<p>Error loading product: ${error.message}</p>`;
    }
}

function renderProductDetail(product: any) {
    if (!productDetailContainer) return;

    productDetailContainer.innerHTML = `
        <h2>${product.name}</h2>
        <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/300'}" alt="${product.name}" style="max-width: 300px; margin-bottom: 20px;">
        <p><strong>Description:</strong> ${product.description}</p>
        <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
        <p><strong>Category:</strong> ${product.category}</p>
        <p><strong>Stock:</strong> ${product.stock > 0 ? product.stock : 'Out of Stock'}</p>
        <p><strong>Seller:</strong> ${product.sellerId?.name || 'N/A'}</p>
        ${product.stock > 0 ? `<button id="add-to-cart-btn" data-product-id="${product._id}">Add to Cart</button>` : '<p>Out of Stock</p>'}
        <div id="add-to-cart-message" style="margin-top:10px; color: green;"></div>
    `;

    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', async () => {
            const token = getToken();
            if (!token) {
                alert('Please login to add items to your cart.');
                window.location.href = `/login.html?redirect=/product-detail.html?id=${product._id}`;
                return;
            }

            const messageEl = document.getElementById('add-to-cart-message');
            if (messageEl) messageEl.textContent = 'Adding...';

            try {
                const response = await fetch(`${API_BASE_URL}/cart/items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ productId: product._id, quantity: 1 })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to add to cart');
                }
                if (messageEl) messageEl.textContent = 'Added to cart successfully!';
                updateCartCount(); // Update cart count in nav
                setTimeout(() => { if(messageEl) messageEl.textContent = ''; }, 3000);
            } catch (error: any) {
                console.error('Add to cart error:', error);
                 if (messageEl) messageEl.textContent = `Error: ${error.message}`;
            }
        });
    }
}

// Initial load for product detail page
if (window.location.pathname.includes('/product-detail.html')) {
    fetchProductDetail();
}