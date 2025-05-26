// frontend/admin/ts/adminAddProduct.ts
import { API_BASE_URL, getToken, removeToken } from '../../ts/main.js'; // Corrected path
const addProductForm = document.getElementById('add-product-form');
const errorElement = document.getElementById('add-product-error');
const successElement = document.getElementById('add-product-success');
const authLinksAdminContainer = document.getElementById('auth-links-admin');
// Admin-specific auth check / nav update
function updateAdminNavOnAddProductPage() {
    console.log("adminAddProduct.ts: updateAdminNavOnAddProductPage called");
    const token = getToken();
    if (authLinksAdminContainer) {
        console.log("adminAddProduct.ts: authLinksAdminContainer found");
        if (token) {
            console.log("adminAddProduct.ts: Token found, setting up logout link");
            authLinksAdminContainer.innerHTML = `<a href="#" id="admin-logout-link-add">Admin Logout</a>`;
            document.getElementById('admin-logout-link-add')?.addEventListener('click', (e) => {
                e.preventDefault();
                removeToken();
                alert('Logged out.');
                window.location.href = '/login.html';
            });
        }
        else {
            console.log("adminAddProduct.ts: No token, redirecting to login");
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
    }
    else {
        console.error("adminAddProduct.ts: authLinksAdminContainer NOT found!");
    }
}
if (addProductForm) {
    console.log("adminAddProduct.ts: addProductForm found, attaching event listener.");
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("adminAddProduct.ts: Add product form submitted."); // 1.
        if (errorElement)
            errorElement.textContent = '';
        if (successElement)
            successElement.textContent = '';
        const token = getToken();
        if (!token) {
            console.error("adminAddProduct.ts: No token found on submit, redirecting.");
            alert('Authentication required. Please login as admin.');
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        console.log("adminAddProduct.ts: Token verified on submit.");
        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('price', document.getElementById('price').value);
        formData.append('category', document.getElementById('category').value);
        formData.append('stock', document.getElementById('stock').value);
        const imageFilesInput = document.getElementById('productImages');
        if (imageFilesInput.files && imageFilesInput.files.length > 0) {
            console.log(`adminAddProduct.ts: Found ${imageFilesInput.files.length} image file(s).`);
            for (let i = 0; i < imageFilesInput.files.length; i++) {
                formData.append('productImages', imageFilesInput.files[i]);
            }
        }
        else {
            console.log("adminAddProduct.ts: No image files selected.");
        }
        try {
            console.log("adminAddProduct.ts: Attempting to add product via API..."); // 2.
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });
            console.log("adminAddProduct.ts: API response status:", response.status); // 3.
            const result = await response.json();
            console.log("adminAddProduct.ts: API response data:", result); // 4.
            if (response.status === 401 || response.status === 403) {
                console.error("adminAddProduct.ts: API returned 401/403, redirecting.");
                removeToken();
                alert('Session expired or insufficient permissions. Please log in again.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            if (!response.ok) {
                console.error("adminAddProduct.ts: API response not OK:", result.message || "No specific error message.");
                throw new Error(result.message || (result.errors ? result.errors.join(', ') : 'Failed to add product'));
            }
            console.log("adminAddProduct.ts: API call successful. Checking successElement..."); // 5.
            console.log("adminAddProduct.ts: Value of successElement just before setting text:", successElement);
            if (successElement) {
                console.log("adminAddProduct.ts: successElement found. Setting text content."); // 6.
                successElement.textContent = 'Product added successfully!';
            }
            else {
                console.error("adminAddProduct.ts: successElement NOT found in the DOM! Message cannot be displayed."); // 7.
            }
            addProductForm.reset();
            console.log("adminAddProduct.ts: Form reset. Setting timeout for redirect."); // 8.
            // MODIFIED TIMEOUT DURATION HERE
            setTimeout(() => {
                console.log("adminAddProduct.ts: Inside setTimeout. Clearing success message and redirecting."); // 9.
                if (successElement)
                    successElement.textContent = '';
                window.location.href = '/admin/products.html';
            }, 4000); // Increased timeout to 20 seconds (20000 milliseconds)
        }
        catch (error) {
            console.error('adminAddProduct.ts: Add product catch block error:', error.message, error.stack);
            if (errorElement)
                errorElement.textContent = error.message || "An unknown error occurred.";
        }
    });
}
else {
    console.error("adminAddProduct.ts: addProductForm NOT found in the DOM!");
}
document.addEventListener('DOMContentLoaded', () => {
    console.log("adminAddProduct.ts: DOMContentLoaded event fired.");
    updateAdminNavOnAddProductPage();
});
