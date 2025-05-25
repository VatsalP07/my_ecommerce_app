    // frontend/ts/productList.ts
    import { API_BASE_URL } from './main.js'; // Assuming main.js is in the same directory (adjust if not after compilation)

    const productListContainer = document.getElementById('product-list');
    const paginationControlsContainer = document.getElementById('pagination-controls');
    let currentPage = 1;
    const limit = 6; // Products per page

    async function fetchProducts(page: number = 1) {
        if (!productListContainer) return;
        productListContainer.innerHTML = '<p>Loading products...</p>';
        console.log(`[productList.ts] Fetching products for page: ${page}`);

        try {
            const response = await fetch(`${API_BASE_URL}/products?page=${page}&limit=${limit}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
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
    if (!productListContainer) return;
    if (!products || products.length === 0) {
        productListContainer.innerHTML = '<p>No products found.</p>';
        return;
    }

    productListContainer.innerHTML = products.map(product => `
        <div class="product-card" data-product-id="${product._id}"> <!-- Added data-product-id to card -->
            <a href="/product-detail.html?id=${product._id}">
                <img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/150'}" alt="${product.name}">
                <h3>${product.name}</h3>
            </a>
            <p class="price">$${product.price.toFixed(2)}</p>
            <p>Category: ${product.category}</p>
            <!-- Added data-stock-display attribute for easier selection -->
            <p class="stock-info" data-stock-display="${product._id}">Stock: ${product.stock > 0 ? product.stock : 'Out of Stock'}</p>
            <button onclick="location.href='/product-detail.html?id=${product._id}'">View Details</button>
        </div>
    `).join('');
    console.log(`[productList.ts] Products rendered.`);
}

    function renderPaginationControls(pagination: any) {
        // ... (existing pagination logic remains the same) ...
        if (!paginationControlsContainer || !pagination) return;
        paginationControlsContainer.innerHTML = '';

        if (pagination.totalPages <= 1) return;

        if (pagination.currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.addEventListener('click', () => {
                currentPage = pagination.currentPage - 1;
                fetchProducts(currentPage);
            });
            paginationControlsContainer.appendChild(prevButton);
        }

        const pageInfo = document.createElement('span');
        pageInfo.textContent = ` Page ${pagination.currentPage} of ${pagination.totalPages} `;
        pageInfo.style.margin = "0 10px";
        paginationControlsContainer.appendChild(pageInfo);

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

    // --- Real-time Stock Update Logic ---
    function updateStockOnProductList(productId: string, newStock: number) {
        console.log(`[productList.ts] Attempting to update stock for product ${productId} to ${newStock} on list page.`);
        // Use the data attribute for more reliable selection
        const stockElement = document.querySelector(`.stock-info[data-stock-display="${productId}"]`);

        if (stockElement) {
            stockElement.textContent = `Stock: ${newStock > 0 ? newStock : 'Out of Stock'}`;
            console.log(`[productList.ts] Stock updated for product ${productId} on list page.`);
            // Optionally, find the parent .product-card and adjust button states or styles
            const productCard = stockElement.closest('.product-card');
            if (productCard) {
                const viewDetailsButton = productCard.querySelector('button');
                // Example: if (viewDetailsButton && newStock === 0) { (viewDetailsButton as HTMLButtonElement).disabled = true; }
            }
        } else {
            // console.log(`[productList.ts] Stock element for product ${productId} not found on this page.`);
        }
    }

    // Listen for the custom browser event dispatched from main.ts
    document.addEventListener('stockUpdatedOnPage', (event: Event) => {
        const customEvent = event as CustomEvent<{ productId: string, newStock: number }>;
        const { productId, newStock } = customEvent.detail;
        console.log(`[productList.ts] Received 'stockUpdatedOnPage' event for product ${productId}, new stock: ${newStock}`);

        // Only update if the product list is currently visible/relevant
        if (document.getElementById('product-list')) { // A simple check
            updateStockOnProductList(productId, newStock);
        }
    });

    // Initial load for product list page
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        console.log(`[productList.ts] Initializing product list page.`);
        fetchProducts(currentPage);
    }