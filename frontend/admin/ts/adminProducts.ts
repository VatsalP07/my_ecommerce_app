// frontend/admin/ts/adminProducts.ts
import { API_BASE_URL, getToken, removeToken, escapeHtml, updateNavAndCart } from '../../ts/main.js'; // Added escapeHtml and updateNavAndCart

const productListContainer = document.getElementById('admin-product-list');
const authLinksAdminContainer = document.getElementById('auth-links-admin'); // This is handled by main.ts now

console.log('[AdminProducts.ts] Script loaded.');

// updateAdminNavOnProductsPage is now handled by the generic updateNavUI in main.ts
// by ensuring #auth-links-admin exists in admin/products.html and main.ts targets it.

async function fetchAdminProducts() {
    console.log('[AdminProducts.ts] fetchAdminProducts called.');
    if (!productListContainer) {
        console.error('[AdminProducts.ts] admin-product-list container NOT FOUND in DOM.');
        return;
    }
    const token = getToken();
    if (!token) {
        // This case should ideally be handled by the DOMContentLoaded redirect if main.js runs first,
        // but as a fallback for this page's specific script:
        console.warn('[AdminProducts.ts] No token found. User should be redirected by main.js nav update.');
        productListContainer.innerHTML = '<p class="text-red-500 p-4">Authentication required. Please <a href="/login.html" class="underline text-indigo-600">log in</a>.</p>';
        return;
    }
    console.log('[AdminProducts.ts] Token found. Fetching products...');
    productListContainer.innerHTML = '<p class="text-gray-500 p-4">Loading products...</p>';

    try {
        // Using the public products endpoint. For admin, you might eventually have a dedicated
        // admin endpoint that returns more data or has different authorization.
        const response = await fetch(`${API_BASE_URL}/products?limit=100`, { // Fetch more for admin view
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`[AdminProducts.ts] API Response Status: ${response.status}`);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.warn('[AdminProducts.ts] Access Denied (401/403). Removing token.');
                removeToken(); // Remove potentially invalid token
                updateNavAndCart(); // This will update UI to show login links
                alert('Access Denied. You may not be an admin or your session has expired. Please log in again.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}` }));
            console.error('[AdminProducts.ts] API fetch not OK:', errorData);
            throw new Error(errorData.message || `Failed to fetch products. Status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[AdminProducts.ts] API fetch successful. Result:', result);

        if (result.data && Array.isArray(result.data)) {
            renderAdminProducts(result.data);
        } else {
            console.warn('[AdminProducts.ts] API response data is not an array or missing:', result);
            productListContainer.innerHTML = '<p class="text-orange-500 p-4">Received unexpected data structure from server.</p>';
        }
    } catch (error: any) {
        console.error('[AdminProducts.ts] Failed to fetch admin products:', error);
        if (productListContainer) { // Check again before setting innerHTML
            productListContainer.innerHTML = `<p class="text-red-600 p-4">Error loading products: ${escapeHtml(error.message)}</p>`;
        }
    }
}

function renderAdminProducts(products: any[]) {
    console.log('[AdminProducts.ts] renderAdminProducts called with products count:', products ? products.length : 'null');
    if (!productListContainer) {
        console.error('[AdminProducts.ts] admin-product-list container NOT FOUND for rendering.');
        return;
    }
    if (!products) {
        productListContainer.innerHTML = '<p class="text-orange-500 p-4">Error: No product data received for rendering.</p>';
        return;
    }
    if (products.length === 0) {
        productListContainer.innerHTML = `
            <div class="text-center py-10">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No Products Found</h3>
                <p class="mt-1 text-sm text-gray-500">There are currently no products in the system.</p>
                <div class="mt-6">
                  <a href="/admin/add-product.html"
                     class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Add New Product
                  </a>
                </div>
            </div>`;
        return;
    }

    const tableHtml = `
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white shadow-md rounded-lg">
                <thead class="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                    <tr>
                        <th class="py-3 px-6 text-left">Image</th>
                        <th class="py-3 px-6 text-left">Name</th>
                        <th class="py-3 px-6 text-left">Category</th>
                        <th class="py-3 px-6 text-center">Price</th>
                        <th class="py-3 px-6 text-center">Stock</th>
                        <th class="py-3 px-6 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="text-gray-700 text-sm divide-y divide-gray-200">
                    ${products.map(product => `
                        <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150">
                            <td class="py-3 px-6 text-left whitespace-nowrap">
                                <img src="${product.imageKeys && product.imageKeys.length > 0 ? escapeHtml(product.imageKeys[0]) : 'https://via.placeholder.com/40x40?text=N/A'}" 
                                     alt="${escapeHtml(product.name)}" class="w-10 h-10 object-cover rounded-md shadow">
                            </td>
                            <td class="py-3 px-6 text-left whitespace-nowrap">
                                <div class="font-medium">${escapeHtml(product.name)}</div>
                                <div class="text-xs text-gray-500">ID: ${product._id}</div>
                            </td>
                            <td class="py-3 px-6 text-left">${escapeHtml(product.category)}</td>
                            <td class="py-3 px-6 text-center">$${parseFloat(product.price).toFixed(2)}</td>
                            <td class="py-3 px-6 text-center">${product.stock}</td>
                            <td class="py-3 px-6 text-center whitespace-nowrap actions">
                                <a href="/admin/edit-product.html?id=${product._id}" 
                                   class="text-indigo-600 hover:text-indigo-800 hover:underline mr-3 px-2 py-1 rounded-md bg-indigo-100 hover:bg-indigo-200 text-xs font-medium">Edit</a>
                                <button class="delete-btn text-red-600 hover:text-red-800 hover:underline px-2 py-1 rounded-md bg-red-100 hover:bg-red-200 text-xs font-medium" 
                                        data-product-id="${product._id}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    productListContainer.innerHTML = tableHtml;
    console.log('[AdminProducts.ts] Products table rendered.');

    // Re-attach event listeners for delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteProduct);
    });
}

async function handleDeleteProduct(event: Event) {
    const button = event.target as HTMLButtonElement;
    const productId = button.dataset.productId;
    const token = getToken();

    if (!productId || !token) {
        alert("Cannot delete product: missing ID or authentication token.");
        return;
    }

    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        console.log(`[AdminProducts.ts] Attempting to delete product ID: ${productId}`);
        try {
            const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`[AdminProducts.ts] Delete API Response Status for ${productId}: ${response.status}`);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    removeToken(); 
                    updateNavAndCart();
                    alert('Session expired or insufficient permissions. Please log in again.'); 
                    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`; 
                    return;
                }
                const errorData = await response.json().catch(() => ({message: 'Failed to delete product due to server error.'}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            alert('Product deleted successfully.');
            fetchAdminProducts(); // Refresh the list
        } catch (error: any) {
            console.error('[AdminProducts.ts] Delete product error:', error);
            alert(`Error deleting product: ${escapeHtml(error.message)}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[AdminProducts.ts] DOMContentLoaded.');
    updateNavAndCart(); // This will handle nav and cart count (main.js function)
    
    // Fetch products if token is valid and user is on this page
    // The updateNavAndCart from main.js already handles auth checks and updating #auth-links-admin
    // We can check if a token still exists after main.js's nav update.
    if (getToken() && productListContainer) { 
      console.log('[AdminProducts.ts] Token seems present after nav update, calling fetchAdminProducts.');
      fetchAdminProducts();
    } else if (!productListContainer) {
        console.error("[AdminProducts.ts] Admin product list container not found on initial load after nav update.");
    } else {
        console.log('[AdminProducts.ts] No token or product list container issue after nav update. Not fetching products.');
    }
});