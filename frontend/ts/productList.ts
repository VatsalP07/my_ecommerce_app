// frontend/ts/productList.ts
import { API_BASE_URL } from './main.js';

const productListContainer = document.getElementById('product-list');
const paginationControlsContainer = document.getElementById('pagination-controls');
let currentPage = 1;
const limit = 6; // Products per page

async function fetchProducts(page: number = 1) {
    if (!productListContainer) return;
    productListContainer.innerHTML = '<p>Loading products...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/products?page=${page}&limit=${limit}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        renderProducts(result.data);
        renderPaginationControls(result.pagination);
    } catch (error) {
        console.error('Failed to fetch products:', error);
        productListContainer.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}

function renderProducts(products: any[]) {
    if (!productListContainer) return;
    if (!products || products.length === 0) {
        productListContainer.innerHTML = '<p>No products found.</p>';
        return;
    }

    productListContainer.innerHTML = products.map(product => `
        <div class="product-card">
            <a href="/product-detail.html?id=${product._id}">
                <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/150'}" alt="${product.name}">
                <h3>${product.name}</h3>
            </a>
            <p class="price">$${product.price.toFixed(2)}</p>
            <p>Category: ${product.category}</p>
            <p>Stock: ${product.stock > 0 ? product.stock : 'Out of Stock'}</p>
            <button onclick="location.href='/product-detail.html?id=${product._id}'">View Details</button>
        </div>
    `).join('');
}

function renderPaginationControls(pagination: any) {
    if (!paginationControlsContainer || !pagination) return;
    paginationControlsContainer.innerHTML = ''; // Clear existing

    if (pagination.totalPages <= 1) return; // No controls if only one page

    // Previous Button
    if (pagination.currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.addEventListener('click', () => {
            currentPage = pagination.currentPage - 1;
            fetchProducts(currentPage);
        });
        paginationControlsContainer.appendChild(prevButton);
    }

    // Page Info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` Page ${pagination.currentPage} of ${pagination.totalPages} `;
    pageInfo.style.margin = "0 10px";
    paginationControlsContainer.appendChild(pageInfo);


    // Next Button
    if (pagination.currentPage < pagination.totalPages) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.addEventListener('click', () => {
            currentPage = pagination.currentPage + 1;
            fetchProducts(currentPage);
        });
        paginationControlsContainer.appendChild(nextButton);
    }
}

// Initial load for product list page
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    fetchProducts(currentPage);
}