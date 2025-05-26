// frontend/admin/ts/adminProducts.ts
import { API_BASE_URL, getToken, removeToken } from '../../ts/main.js'; // Corrected path
const productListContainer = document.getElementById('admin-product-list'); // HTMLElement | null
const authLinksAdminContainer = document.getElementById('auth-links-admin');
function updateAdminNavOnProductsPage() {
    // ... (as before, handles redirection if no token)
    const token = getToken();
    if (authLinksAdminContainer) {
        if (token) {
            authLinksAdminContainer.innerHTML = `<a href="#" id="admin-logout-link-products">Admin Logout</a>`;
            document.getElementById('admin-logout-link-products')?.addEventListener('click', (e) => {
                e.preventDefault();
                removeToken();
                alert('Logged out.');
                window.location.href = '/login.html';
            });
        }
        else {
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
    }
}
async function fetchAdminProducts() {
    if (!productListContainer) { // Guard clause for productListContainer
        console.error("Admin product list container not found in DOM.");
        return;
    }
    const token = getToken();
    if (!token) {
        productListContainer.innerHTML = '<p>Authentication required. Please log in.</p>';
        return;
    }
    productListContainer.innerHTML = '<p>Loading products...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/products?limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            removeToken();
            alert('Access Denied. You may not be an admin or your session has expired.');
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.data && Array.isArray(result.data)) {
            renderAdminProducts(result.data); // Call render only if container exists (checked above)
        }
        else {
            throw new Error("Unexpected response structure for products.");
        }
    }
    catch (error) {
        console.error('Failed to fetch admin products:', error);
        if (productListContainer) { // Check again before setting innerHTML
            productListContainer.innerHTML = '<p>Error loading products. Ensure you are logged in as an admin.</p>';
        }
    }
}
function renderAdminProducts(products) {
    // This function is now only called if productListContainer is guaranteed to be non-null
    // by the calling function (fetchAdminProducts).
    // However, a defensive check is still good practice if it could be called from elsewhere.
    if (!productListContainer)
        return; // Should ideally not be needed if fetchAdminProducts guards it
    if (!products) { // Check if products array itself is null/undefined
        productListContainer.innerHTML = '<p>Error: No product data received.</p>';
        return;
    }
    if (products.length === 0) {
        productListContainer.innerHTML = '<p>No products to display. <a href="/admin/add-product.html">Add one?</a></p>';
        return;
    }
    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td><img src="${product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : 'https://via.placeholder.com/50'}" alt="${product.name}" style="width:50px; height:auto;"></td>
                        <td>${product.name}</td>
                        <td>${product.category}</td>
                        <td>$${product.price.toFixed(2)}</td>
                        <td>${product.stock}</td>
                        <td class="actions">
                            <a href="/admin/edit-product.html?id=${product._id}" class="edit-btn">Edit</a>
                            <button class="delete-btn" data-product-id="${product._id}">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    productListContainer.innerHTML = tableHtml;
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteProduct);
    });
}
async function handleDeleteProduct(event) {
    const button = event.target;
    const productId = button.dataset.productId;
    const token = getToken();
    if (!productId || !token) {
        alert("Cannot delete product: missing ID or authentication token.");
        return;
    }
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        try {
            // ... (fetch logic as before)
            const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                removeToken();
                alert('Session expired or insufficient permissions. Please log in again.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to delete product due to server error.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            alert('Product deleted successfully.');
            // fetchAdminProducts will re-render, and it already checks for productListContainer
            fetchAdminProducts();
        }
        catch (error) {
            console.error('Delete product error:', error);
            alert(`Error deleting product: ${error.message}`);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    updateAdminNavOnProductsPage();
    // Only attempt to fetch products if the productListContainer exists AND
    // the nav update didn't redirect (which implies a token probably exists).
    if (productListContainer && document.getElementById('admin-logout-link-products')) {
        fetchAdminProducts();
    }
    else if (!productListContainer) {
        console.error("Admin product list container not found in DOM on initial load.");
    }
});
