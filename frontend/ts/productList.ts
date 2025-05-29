import { API_BASE_URL } from './main.js';

const productListContainer = document.getElementById('product-list');
const paginationControlsContainer = document.getElementById('pagination-controls');
let currentPage = 1;
const limit = 6;

async function fetchProducts(page: number = 1) {
    if (!productListContainer) return;
    productListContainer.innerHTML = '<p>Loading products...</p>';
    console.log(`[productList.ts] Fetching products for page: ${page}`);
    try {
        const response = await fetch(`${API_BASE_URL}/products?page=${page}&limit=${limit}`);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const result = await response.json();
        console.log(`[productList.ts] Products fetched:`, result);
        renderProducts(result.data);
        renderPaginationControls(result.pagination);
    } catch (error) {
        console.error('[productList.ts] Failed to fetch products:', error);
        productListContainer.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}

function renderProducts(products: any[]) {
    // ... (renderProducts function as you provided, ensure data-product-id and data-stock-display attributes) ...
    if (!productListContainer) return;
    if (!products || products.length === 0) { productListContainer.innerHTML = '<p>No products found.</p>'; return; }
    productListContainer.innerHTML = products.map(product => `
        <div class="product-card" data-product-id="${product._id}">
            <a href="/product-detail.html?id=${product._id}">
                <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/150'}" alt="${product.name}">
                <h3>${product.name}</h3>
            </a>
            <p class="price">$${product.price.toFixed(2)}</p>
            <p>Category: ${product.category}</p>
            <p class="stock-info" data-stock-display="${product._id}">Stock: ${product.stock > 0 ? product.stock : 'Out of Stock'}</p>
            <button onclick="window.location.href='/product-detail.html?id=${product._id}'">View Details</button>
        </div>
    `).join('');
}
function renderPaginationControls(pagination: any) {
    // ... (renderPaginationControls function as you provided) ...
    if (!paginationControlsContainer || !pagination || pagination.totalPages <= 1) { if(paginationControlsContainer) paginationControlsContainer.innerHTML = ''; return; }
    paginationControlsContainer.innerHTML = '';
    if (pagination.currentPage > 1) { /* ... prev button ... */ }
    const pageInfo = document.createElement('span'); /* ... page info ... */
    paginationControlsContainer.appendChild(pageInfo);
    if (pagination.currentPage < pagination.totalPages) { /* ... next button ... */ }
}
function updateStockOnProductList(productId: string, newStock: number) {
    // ... (updateStockOnProductList function as you provided) ...
    const stockElement = document.querySelector(`.stock-info[data-stock-display="${productId}"]`);
    if (stockElement) { stockElement.textContent = `Stock: ${newStock > 0 ? newStock : 'Out of Stock'}`; }
}

document.addEventListener('stockUpdatedOnPage', (event: Event) => {
    // ... (stockUpdatedOnPage listener as you provided) ...
    const customEvent = event as CustomEvent<{ productId: string, newStock: number }>;
    if (customEvent.detail) {
        const { productId, newStock } = customEvent.detail;
        if (document.getElementById('product-list')) { updateStockOnProductList(productId, newStock); }
    }
});

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    fetchProducts(currentPage);
}