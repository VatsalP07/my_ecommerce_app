// frontend/admin/ts/adminAddProduct.ts
import { API_BASE_URL, getToken, removeToken, updateNavAndCart } from '../../ts/main.js'; // Assuming updateNavAndCart from main.js handles admin nav now
const addProductForm = document.getElementById('add-product-form');
const errorElement = document.getElementById('add-product-error');
const successElement = document.getElementById('add-product-success');
// const authLinksAdminContainer = document.getElementById('auth-links-admin'); // MOVED
// Admin-specific nav update is now primarily handled by main.js's updateNavAndCart
// This function can be simplified or removed if main.js correctly targets #auth-links-admin
function ensureAdminNavIsHandledByMain() {
    console.log("adminAddProduct.ts: ensureAdminNavIsHandledByMain called - main.js should handle #auth-links-admin.");
    const token = getToken();
    const adminNav = document.getElementById('auth-links-admin');
    if (!adminNav) {
        console.error("adminAddProduct.ts: #auth-links-admin container still NOT found by this script! Check HTML and main.js.");
    }
    else {
        console.log("adminAddProduct.ts: #auth-links-admin container was found by this script.");
        if (!token && (window.location.pathname.includes('/admin/'))) { // If main.js didn't redirect, force it
            console.warn("adminAddProduct.ts: No token, but on admin page. Forcing redirect (main.js should ideally handle this).");
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
    }
}
if (addProductForm) {
    console.log("adminAddProduct.ts: addProductForm found, attaching event listener.");
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("adminAddProduct.ts: Add product form submitted.");
        if (errorElement)
            errorElement.textContent = '';
        if (successElement)
            successElement.textContent = '';
        const token = getToken();
        if (!token) {
            console.error("adminAddProduct.ts: No token found on submit, redirecting.");
            alert('Authentication required. Please login as admin.');
            // updateNavAndCart() from main.js should have already updated nav and potentially redirected
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        console.log("adminAddProduct.ts: Token verified on submit.");
        const formData = new FormData();
        const nameInput = document.getElementById('name');
        const descriptionInput = document.getElementById('description');
        const priceInput = document.getElementById('price');
        const categoryInput = document.getElementById('category');
        const stockInput = document.getElementById('stock');
        // Add null checks for these inputs before accessing .value
        if (!nameInput || !descriptionInput || !priceInput || !categoryInput || !stockInput) {
            console.error("adminAddProduct.ts: One or more form input fields are missing from the DOM.");
            if (errorElement)
                errorElement.textContent = "A form field is missing. Please contact support.";
            return;
        }
        formData.append('name', nameInput.value);
        formData.append('description', descriptionInput.value);
        formData.append('price', priceInput.value);
        formData.append('category', categoryInput.value);
        formData.append('stock', stockInput.value);
        const imageFilesInput = document.getElementById('productImages');
        if (imageFilesInput && imageFilesInput.files && imageFilesInput.files.length > 0) {
            console.log(`adminAddProduct.ts: Found ${imageFilesInput.files.length} image file(s).`);
            for (let i = 0; i < imageFilesInput.files.length; i++) {
                formData.append('productImages', imageFilesInput.files[i]);
            }
        }
        else {
            console.log("adminAddProduct.ts: No image files selected.");
        }
        try {
            console.log("adminAddProduct.ts: Attempting to add product via API...");
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });
            console.log("adminAddProduct.ts: API response status:", response.status);
            const result = await response.json();
            console.log("adminAddProduct.ts: API response data:", result);
            if (!response.ok) { // Check response.ok instead of specific statuses here for general failure
                console.error("adminAddProduct.ts: API response not OK:", result.message || "No specific error message.");
                // Handle 401/403 specifically if needed for token removal, otherwise let general error through
                if (response.status === 401 || response.status === 403) {
                    removeToken();
                    updateNavAndCart(); // Update UI
                    alert('Session expired or insufficient permissions. Please log in again.');
                    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                    return;
                }
                throw new Error(result.message || (result.errors ? result.errors.join(', ') : `Failed to add product. Status: ${response.status}`));
            }
            console.log("adminAddProduct.ts: API call successful.");
            if (successElement) {
                successElement.textContent = 'Product added successfully!';
                successElement.classList.remove('hidden'); // If you use hidden utility class
                successElement.style.color = 'green';
            }
            else {
                console.error("adminAddProduct.ts: successElement NOT found in the DOM! Message cannot be displayed.");
            }
            addProductForm.reset();
            console.log("adminAddProduct.ts: Form reset. Setting timeout for redirect.");
            setTimeout(() => {
                console.log("adminAddProduct.ts: Inside setTimeout. Clearing success message and redirecting.");
                if (successElement)
                    successElement.textContent = '';
                window.location.href = '/admin/products.html';
            }, 2500); // Slightly longer for user to see success
        }
        catch (error) {
            console.error('adminAddProduct.ts: Add product catch block error:', error.message, error.stack);
            if (errorElement) {
                errorElement.textContent = error.message || "An unknown error occurred.";
                errorElement.classList.remove('hidden');
                errorElement.style.color = 'red';
            }
        }
    });
}
else {
    console.error("adminAddProduct.ts: addProductForm NOT found in the DOM!");
}
document.addEventListener('DOMContentLoaded', () => {
    console.log("adminAddProduct.ts: DOMContentLoaded event fired.");
    // main.js should be handling the nav update including #auth-links-admin
    // We call updateNavAndCart here just to be sure cart count (if any in admin nav) is also updated
    // and to trigger its internal auth checks which might redirect if main.js didn't run first or missed it.
    updateNavAndCart();
    ensureAdminNavIsHandledByMain(); // A check to see if main.js is doing its job for admin nav
});
