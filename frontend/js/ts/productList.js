// frontend/ts/productList.ts
import { API_BASE_URL, escapeHtml } from './main.js'; // Ensure escapeHtml is exported and imported
const productListContainer = document.getElementById('product-list');
const paginationControlsContainer = document.getElementById('pagination-controls');
const productListHeadingElement = document.getElementById('product-list-heading');
const heroSection = document.querySelector('header.bg-gradient-to-r'); // Assuming this is your hero section
let currentPage = 1;
const limit = 6; // Products per page
// --- Hero Animation Logic (Keep if you have it from previous step) ---
function animateHeroElements() {
    const headline = document.getElementById('hero-headline');
    if (!headline)
        return; // Only animate if hero elements are present (i.e., on homepage)
    const subheadline = document.getElementById('hero-subheadline');
    const ctaButton = document.getElementById('hero-cta');
    const chars = headline.querySelectorAll('.hero-char');
    chars.forEach((char, index) => {
        setTimeout(() => { char.classList.add('visible'); }, index * 70);
    });
    const headlineAnimationTime = (chars.length * 70) + 600;
    if (subheadline) {
        setTimeout(() => { subheadline.classList.add('visible'); }, headlineAnimationTime);
    }
    if (ctaButton) {
        setTimeout(() => { ctaButton.classList.add('visible'); }, headlineAnimationTime + 300);
    }
}
// --- END: Hero Animation Logic ---
async function fetchProducts(page = 1) {
    if (!productListContainer)
        return;
    productListContainer.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">Loading products...</p>';
    if (paginationControlsContainer)
        paginationControlsContainer.innerHTML = '';
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('search'); // Get 'search' term from URL
    let apiUrl = `${API_BASE_URL}/products?page=${page}&limit=${limit}`; // Default API URL
    if (searchTerm) {
        apiUrl = `${API_BASE_URL}/products/search?q=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`;
        if (productListHeadingElement) {
            productListHeadingElement.textContent = `Search Results for: "${escapeHtml(searchTerm)}"`;
        }
        if (heroSection) { // Hide hero section when showing search results
            heroSection.style.display = 'none';
        }
        const shopByCategorySection = document.querySelector('section.bg-slate-50'); // Selector for shop by category
        if (shopByCategorySection)
            shopByCategorySection.style.display = 'none';
    }
    else {
        if (productListHeadingElement) {
            productListHeadingElement.textContent = 'Featured Products';
        }
        if (heroSection) { // Show hero section if not a search
            heroSection.style.display = 'block'; // Or whatever its default display was
        }
        const shopByCategorySection = document.querySelector('section.bg-slate-50');
        if (shopByCategorySection)
            shopByCategorySection.style.display = 'block'; // Or flex etc.
        if (document.getElementById('hero-headline'))
            animateHeroElements(); // Animate hero only on default load
    }
    console.log(`[productList.ts] Fetching from: ${apiUrl}`);
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message);
        }
        const result = await response.json();
        console.log(`[productList.ts] Products API response:`, result);
        if (result.data && Array.isArray(result.data)) {
            renderProducts(result.data);
        }
        else {
            renderProducts([]);
        }
        if (result.pagination) {
            renderPaginationControls(result.pagination);
        }
        else {
            if (result.data && result.data.length > 0) {
                renderPaginationControls({ currentPage: 1, totalPages: 1, totalProducts: result.data.length, pageSize: result.data.length });
            }
            else if (result.data && result.data.length === 0) {
                renderPaginationControls({ currentPage: 1, totalPages: 0, totalProducts: 0, pageSize: limit });
            }
        }
    }
    catch (error) {
        console.error('[productList.ts] Failed to fetch products:', error);
        productListContainer.innerHTML = `<p class="col-span-full text-center text-red-600 py-10">Error loading products: ${escapeHtml(error.message)}</p>`;
    }
}
function renderProducts(products) {
    // ... (Your existing, styled renderProducts function from Day 18) ...
    // No changes needed here if it's already good.
    if (!productListContainer)
        return;
    if (!products || products.length === 0) {
        const currentSearchTerm = new URLSearchParams(window.location.search).get('search');
        if (currentSearchTerm) {
            productListContainer.innerHTML = `<p class="col-span-full text-center text-gray-600 py-10">No products found matching your search: "${escapeHtml(currentSearchTerm)}". Try a different term!</p>`;
        }
        else {
            productListContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 py-10">No products available at this moment. Please check back later!</p>';
        }
        return;
    }
    productListContainer.innerHTML = products.map(product => `
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
function renderPaginationControls(pagination) {
    // ... (Your existing, styled renderPaginationControls function from Day 18) ...
    // No changes needed here if it's already good.
    if (!paginationControlsContainer) {
        return;
    }
    paginationControlsContainer.innerHTML = '';
    if (!pagination || typeof pagination.totalPages !== 'number' || pagination.totalPages <= 0) {
        return;
    }
    if (pagination.totalPages === 1 && pagination.totalProducts <= limit) {
        return;
    }
    const createButton = (text, pageNum, isCurrent = false, isDisabled = false, isEllipsis = false) => {
        const button = document.createElement('button');
        button.innerHTML = text.toString();
        button.disabled = isDisabled || isEllipsis;
        let baseClasses = "mx-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50";
        if (isEllipsis)
            button.className = `${baseClasses} text-gray-500 cursor-default px-2`;
        else if (isCurrent)
            button.className = `${baseClasses} bg-indigo-600 text-white border border-indigo-600 cursor-default`;
        else if (isDisabled)
            button.className = `${baseClasses} bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed`;
        else
            button.className = `${baseClasses} bg-white text-indigo-600 border border-gray-300 hover:bg-indigo-50 hover:border-indigo-500`;
        if (!isDisabled && !isCurrent && !isEllipsis) {
            button.addEventListener('click', () => {
                currentPage = pageNum;
                fetchProducts(currentPage);
                document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        return button;
    };
    paginationControlsContainer.appendChild(createButton('« Prev', pagination.currentPage - 1, false, pagination.currentPage <= 1));
    const totalPages = pagination.totalPages;
    const currentPageNum = pagination.currentPage;
    const pageBuffer = 2;
    paginationControlsContainer.appendChild(createButton(1, 1, currentPageNum === 1));
    if (currentPageNum > pageBuffer + 2 && totalPages > maxPagesToShowOverall)
        paginationControlsContainer.appendChild(createButton('...', 0, false, true, true));
    let startPage = Math.max(2, currentPageNum - pageBuffer);
    let endPage = Math.min(totalPages - 1, currentPageNum + pageBuffer);
    for (let i = startPage; i <= endPage; i++)
        paginationControlsContainer.appendChild(createButton(i, i, currentPageNum === i));
    if (currentPageNum < totalPages - pageBuffer - 1 && totalPages > maxPagesToShowOverall)
        paginationControlsContainer.appendChild(createButton('...', 0, false, true, true));
    if (totalPages > 1)
        paginationControlsContainer.appendChild(createButton(totalPages, totalPages, currentPageNum === totalPages));
    paginationControlsContainer.appendChild(createButton('Next »', pagination.currentPage + 1, false, pagination.currentPage >= totalPages));
}
const maxPagesToShowOverall = 7;
function updateStockOnProductList(productId, newStock) {
    // ... (Your existing updateStockOnProductList function) ...
    const stockElement = document.querySelector(`.stock-info[data-stock-display="${productId}"]`);
    if (stockElement) {
        stockElement.innerHTML = newStock > 0 ? `<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 align-middle"></span> ${newStock} In Stock` : '<span class="inline-block w-2 h-2 bg-red-500 rounded-full mr-1 align-middle"></span> Out of Stock';
        stockElement.className = `stock-info text-xs font-medium mb-4 ${newStock > 0 ? 'text-green-600' : 'text-red-600'}`;
    }
}
document.addEventListener('stockUpdatedOnPage', (event) => {
    const customEvent = event;
    if (customEvent.detail) {
        const { productId, newStock } = customEvent.detail;
        if (document.getElementById('product-list')) {
            updateStockOnProductList(productId, newStock);
        }
    }
});
// Initial load for product list page (handles search and page params from URL)
if (document.getElementById('product-list')) {
    const initialParams = new URLSearchParams(window.location.search);
    currentPage = parseInt(initialParams.get('page') || '1');
    // The fetchProducts function will now check for 'search' param internally
    fetchProducts(currentPage);
    // Only animate hero if NOT on a search results view
    if (!initialParams.has('search') && document.getElementById('hero-headline')) {
        animateHeroElements();
    }
}
