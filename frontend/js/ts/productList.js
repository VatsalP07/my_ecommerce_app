// frontend/ts/productList.ts
import { API_BASE_URL } from './main.js';
const productListContainer = document.getElementById('product-list');
const paginationControlsContainer = document.getElementById('pagination-controls');
let currentPage = 1;
const limit = 6; // Products per page
async function fetchProducts(page = 1) {
    if (!productListContainer)
        return;
    productListContainer.innerHTML = '<p>Loading products...</p>';
    console.log(`[productList.ts] Fetching products for page: ${page}`);
    try {
        const response = await fetch(`${API_BASE_URL}/products?page=${page}&limit=${limit}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log(`[productList.ts] Products fetched. Full result:`, result); // Log the full result
        console.log(`[productList.ts] Pagination data received:`, result.pagination); // Specifically log pagination
        renderProducts(result.data);
        renderPaginationControls(result.pagination); // Pass the pagination object
    }
    catch (error) {
        console.error('[productList.ts] Failed to fetch products:', error);
        productListContainer.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}
function renderProducts(products) {
    if (!productListContainer)
        return;
    if (!products || products.length === 0) {
        productListContainer.innerHTML = '<p>No products found.</p>';
        return;
    }
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
    console.log("[productList.ts] Products rendered.");
}
function renderPaginationControls(pagination) {
    if (!paginationControlsContainer) {
        console.warn("[productList.ts] Pagination container not found in DOM.");
        return;
    }
    console.log("[productList.ts] renderPaginationControls called with:", pagination);
    if (!pagination || typeof pagination.totalPages !== 'number' || typeof pagination.currentPage !== 'number') {
        console.warn("[productList.ts] Invalid or missing pagination data. Clearing controls.");
        paginationControlsContainer.innerHTML = '';
        return;
    }
    // Clear existing controls
    paginationControlsContainer.innerHTML = '';
    if (pagination.totalPages <= 1) {
        console.log("[productList.ts] Total pages <= 1, no pagination controls needed.");
        return; // No controls needed if only one page or no pages
    }
    // Previous Button
    if (pagination.currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.id = 'prev-page-btn';
        prevButton.addEventListener('click', () => {
            currentPage = pagination.currentPage - 1;
            fetchProducts(currentPage);
        });
        paginationControlsContainer.appendChild(prevButton);
    }
    // Page Info Span
    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` Page ${pagination.currentPage} of ${pagination.totalPages} `;
    pageInfo.style.margin = "0 10px";
    paginationControlsContainer.appendChild(pageInfo);
    // Next Button
    if (pagination.currentPage < pagination.totalPages) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.id = 'next-page-btn';
        nextButton.addEventListener('click', () => {
            currentPage = pagination.currentPage + 1;
            fetchProducts(currentPage);
        });
        paginationControlsContainer.appendChild(nextButton);
    }
    console.log("[productList.ts] Pagination controls rendered.");
}
function updateStockOnProductList(productId, newStock) {
    const stockElement = document.querySelector(`.stock-info[data-stock-display="${productId}"]`);
    if (stockElement) {
        stockElement.textContent = `Stock: ${newStock > 0 ? newStock : 'Out of Stock'}`;
    }
}
document.addEventListener('stockUpdatedOnPage', (event) => {
    const customEvent = event;
    if (customEvent.detail) {
        const { productId, newStock } = customEvent.detail;
        // Only update if the product list container is present on the current page
        if (document.getElementById('product-list')) {
            updateStockOnProductList(productId, newStock);
        }
    }
});
// Initial load for product list page
if (document.getElementById('product-list')) { // More robust check
    fetchProducts(currentPage);
}
