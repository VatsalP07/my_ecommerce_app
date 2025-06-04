// frontend/ts/categoryPage.ts
import { API_BASE_URL, escapeHtml, updateNavAndCart } from './main.js'; // Import necessary functions

const categoryProductListContainer = document.getElementById('category-product-list');
const categoryPaginationControlsContainer = document.getElementById('category-pagination-controls');
const categoryPageTitleElement = document.getElementById('category-page-title');
const categoryNamePlaceholder = document.getElementById('category-name-placeholder');
const pageDocumentTitle = document.querySelector('title');

let currentCategoryPage = 1;
const categoryLimit = 6; // Products per page for category view
let currentCategoryName: string | null = null;

async function fetchCategoryProducts(categoryName: string, page: number = 1) {
    if (!categoryProductListContainer || !categoryName) return;

    categoryProductListContainer.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">Loading products...</p>';
    if (categoryPaginationControlsContainer) categoryPaginationControlsContainer.innerHTML = '';

    const apiUrl = `${API_BASE_URL}/products?category=${encodeURIComponent(categoryName)}&page=${page}&limit=${categoryLimit}`;
    console.log(`[categoryPage.ts] Fetching from: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message);
        }
        const result = await response.json();
        console.log(`[categoryPage.ts] Category products API response:`, result);
        
        if (result.data && Array.isArray(result.data)) {
            renderCategoryProducts(result.data);
        } else {
            renderCategoryProducts([]);
        }
        if (result.pagination) {
            renderCategoryPaginationControls(result.pagination);
        } else {
             if (result.data && result.data.length > 0) { // If data but no pagination object, assume 1 page
                renderCategoryPaginationControls({ currentPage: 1, totalPages: 1, totalProducts: result.data.length, pageSize: result.data.length });
             } else if (result.data && result.data.length === 0) {
                renderCategoryPaginationControls({ currentPage: 1, totalPages: 0, totalProducts: 0, pageSize: categoryLimit });
             }
        }
    } catch (error: any) {
        console.error('[categoryPage.ts] Failed to fetch category products:', error);
        if (categoryProductListContainer) {
            categoryProductListContainer.innerHTML = `<p class="col-span-full text-center text-red-600 py-10">Error loading products: ${escapeHtml(error.message)}</p>`;
        }
    }
}

function renderCategoryProducts(products: any[]) {
    // This function can be IDENTICAL to renderProducts in productList.ts
    // For DRY principle, you could move renderProducts to main.ts or a shared utils.ts
    // For now, let's copy it and adapt the container ID
    if (!categoryProductListContainer) return;
    if (!products || products.length === 0) {
        categoryProductListContainer.innerHTML = `<p class="col-span-full text-center text-gray-600 py-10">No products found in the "${escapeHtml(currentCategoryName || 'selected')}" category.</p>`;
        return;
    }

    categoryProductListContainer.innerHTML = products.map(product => `
        <div class="product-card flex flex-col bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-all duration-300 ease-in-out group" data-product-id="${product._id}">
            <a href="/product-detail.html?id=${product._id}" class="block relative h-56 sm:h-64 overflow-hidden">
                <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/400x300?text=No+Image+Available'}" 
                     alt="${escapeHtml(product.name)}" class="w-full h-full object-cover group-hover:opacity-80 transition-opacity duration-300">
            </a>
            <div class="p-5 flex flex-col flex-grow">
                <p class="text-xs text-gray-500 mb-1 uppercase tracking-wider">${escapeHtml(product.category)}</p>
                <h3 class="text-lg font-semibold text-gray-900 mb-2 truncate h-14 leading-tight" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
                <div class="mt-auto">
                    <p class="text-2xl font-bold text-indigo-600 mb-3">$${parseFloat(product.price).toFixed(2)}</p>
                    <p class="stock-info text-xs font-medium mb-4 ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}" data-stock-display="${product._id}">
                        ${product.stock > 0 ? `<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 align-middle"></span> ${product.stock} In Stock` : '<span class="inline-block w-2 h-2 bg-red-500 rounded-full mr-1 align-middle"></span> Out of Stock'}
                    </p>
                    <button onclick="window.location.href='/product-detail.html?id=${product._id}'" 
                            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 text-sm">
                        View Details
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCategoryPaginationControls(pagination: any) {
    // This function can be IDENTICAL to renderPaginationControls in productList.ts
    // For DRY principle, move to main.ts or shared utils.ts
    // For now, copy and adapt container ID and fetch function
    if (!categoryPaginationControlsContainer) { return; }    
    categoryPaginationControlsContainer.innerHTML = '';

    if (!pagination || typeof pagination.totalPages !== 'number' || pagination.totalPages <= 0) {
        return; 
    }
    if (pagination.totalPages === 1 && pagination.totalProducts <= categoryLimit) {
        return;
    }

    const createButton = (text: string | number, pageNum: number, isCurrent: boolean = false, isDisabled: boolean = false, isEllipsis: boolean = false) => {
        const button = document.createElement('button');
        button.innerHTML = text.toString();
        button.disabled = isDisabled || isEllipsis;
        let baseClasses = "mx-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50";
        if (isEllipsis) button.className = `${baseClasses} text-gray-500 cursor-default px-2`;
        else if (isCurrent) button.className = `${baseClasses} bg-indigo-600 text-white border border-indigo-600 cursor-default`;
        else if (isDisabled) button.className = `${baseClasses} bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed`;
        else button.className = `${baseClasses} bg-white text-indigo-600 border border-gray-300 hover:bg-indigo-50 hover:border-indigo-500`;
        if (!isDisabled && !isCurrent && !isEllipsis) {
            button.addEventListener('click', () => {
                currentCategoryPage = pageNum;
                if (currentCategoryName) fetchCategoryProducts(currentCategoryName, currentCategoryPage);
                document.getElementById('category-products-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        return button;
    };

    categoryPaginationControlsContainer.appendChild(createButton('« Prev', pagination.currentPage - 1, false, pagination.currentPage <= 1));
    const totalPages = pagination.totalPages; const currentPageNum = pagination.currentPage; const pageBuffer = 2;
    categoryPaginationControlsContainer.appendChild(createButton(1, 1, currentPageNum === 1));
    if (currentPageNum > pageBuffer + 2 && totalPages > maxPagesToShowOverall) categoryPaginationControlsContainer.appendChild(createButton('...', 0, false, true, true));
    let startPage = Math.max(2, currentPageNum - pageBuffer); let endPage = Math.min(totalPages - 1, currentPageNum + pageBuffer);
    for (let i = startPage; i <= endPage; i++) categoryPaginationControlsContainer.appendChild(createButton(i, i, currentPageNum === i));
    if (currentPageNum < totalPages - pageBuffer - 1 && totalPages > maxPagesToShowOverall) categoryPaginationControlsContainer.appendChild(createButton('...', 0, false, true, true));
    if (totalPages > 1) categoryPaginationControlsContainer.appendChild(createButton(totalPages, totalPages, currentPageNum === totalPages));
    categoryPaginationControlsContainer.appendChild(createButton('Next »', pagination.currentPage + 1, false, pagination.currentPage >= totalPages));
}

const maxPagesToShowOverall = 7; // Same as in productList.ts

// Specific stock update for category page (could also be shared)
function updateStockOnCategoryPage(productId: string, newStock: number) {
    const stockElement = document.querySelector(`#category-product-list .stock-info[data-stock-display="${productId}"]`);
    if (stockElement) {
        stockElement.innerHTML = newStock > 0 ? `<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 align-middle"></span> ${newStock} In Stock` : '<span class="inline-block w-2 h-2 bg-red-500 rounded-full mr-1 align-middle"></span> Out of Stock';
        stockElement.className = `stock-info text-xs font-medium mb-4 ${newStock > 0 ? 'text-green-600' : 'text-red-600'}`;
    }
}

document.addEventListener('stockUpdatedOnPage', (event: Event) => {
    const customEvent = event as CustomEvent<{ productId: string, newStock: number }>;
    if (customEvent.detail) {
        const { productId, newStock } = customEvent.detail;
        if (document.getElementById('category-product-list')) { // Only if on category page
            updateStockOnCategoryPage(productId, newStock);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    updateNavAndCart(); // Initialize nav and cart count

    const params = new URLSearchParams(window.location.search);
    const categoryNameFromURL = params.get('name');
    currentCategoryPage = parseInt(params.get('page') || '1');

    if (categoryNameFromURL) {
        currentCategoryName = categoryNameFromURL;
        const formattedCategoryName = currentCategoryName.charAt(0).toUpperCase() + currentCategoryName.slice(1);
        if (categoryNamePlaceholder) {
            categoryNamePlaceholder.textContent = escapeHtml(formattedCategoryName);
        }
        if (pageDocumentTitle) {
            pageDocumentTitle.textContent = `${escapeHtml(formattedCategoryName)} Products - MyStore`;
        }
        fetchCategoryProducts(currentCategoryName, currentCategoryPage);
    } else {
        if (categoryPageTitleElement) {
            categoryPageTitleElement.textContent = 'Category Not Specified';
        }
        if (categoryProductListContainer) {
            categoryProductListContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 py-10">No category selected. Please choose a category from the menu.</p>';
        }
    }
});