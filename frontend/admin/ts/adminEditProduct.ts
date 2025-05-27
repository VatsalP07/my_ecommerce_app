// frontend/admin/ts/adminEditProduct.ts
import { API_BASE_URL, getToken, removeToken } from '../../ts/main.js'; // Correct path

const formContainer = document.getElementById('edit-product-form-container');
const authLinksAdminContainer = document.getElementById('auth-links-admin');
let currentProductId: string | null = null;

// Admin-specific auth check / nav update
function updateAdminNavOnEditPage() {
    const token = getToken();
    if (authLinksAdminContainer) {
        if (token) {
            authLinksAdminContainer.innerHTML = `<a href="#" id="admin-logout-link-edit">Admin Logout</a>`;
            document.getElementById('admin-logout-link-edit')?.addEventListener('click', (e) => {
                e.preventDefault();
                removeToken();
                alert('Logged out.');
                window.location.href = '/login.html';
            });
        } else {
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
    }
}

async function fetchProductForEdit(productId: string) {
    if (!formContainer) return;
    const token = getToken();
    if (!token) return; // Should be handled by updateAdminNavOnEditPage

    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            headers: { 'Authorization': `Bearer ${token}` } // Assuming get product by ID might need auth for admin editing context
        });
        if (!response.ok) {
            if (response.status === 404) throw new Error('Product not found.');
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const product = await response.json();
        renderEditForm(product);
    } catch (error: any) {
        formContainer.innerHTML = `<p>Error loading product data: ${error.message}</p>`;
        console.error("Fetch product for edit error:", error);
    }
}

function renderEditForm(product: any) {
    if (!formContainer) return;
    currentProductId = product._id;

    // MVP: For imageKeys, just display them. Deletion/replacement is more complex.
    let existingImagesHTML = '<p>No current images.</p>';
    if (product.imageKeys && product.imageKeys.length > 0) {
        existingImagesHTML = '<div><strong>Current Images:</strong><ul>';
        product.imageKeys.forEach((imgUrl: string) => {
            existingImagesHTML += `<li><img src="${imgUrl}" alt="Product Image" style="width:100px; height:auto; margin-right: 10px;"> <small>${imgUrl.split('/').pop()}</small></li>`;
        });
        existingImagesHTML += '</ul></div>';
    }

    formContainer.innerHTML = `
        <form id="edit-product-form">
            <input type="hidden" id="productId" value="${product._id}">
            <div class="form-group">
                <label for="name">Product Name:</label>
                <input type="text" id="name" name="name" value="${product.name}" required>
            </div>
            <div class="form-group">
                <label for="description">Description:</label>
                <textarea id="description" name="description" rows="4" required style="width: calc(100% - 22px); padding: 10px;">${product.description}</textarea>
            </div>
            <div class="form-group">
                <label for="price">Price:</label>
                <input type="number" id="price" name="price" step="0.01" min="0" value="${product.price}" required>
            </div>
            <div class="form-group">
                <label for="category">Category:</label>
                <input type="text" id="category" name="category" value="${product.category}" required>
            </div>
            <div class="form-group">
                <label for="stock">Stock Quantity:</label>
                <input type="number" id="stock" name="stock" min="0" value="${product.stock}" required>
            </div>
            ${existingImagesHTML}
            <div class="form-group">
                <label for="newProductImages">Upload New Images (Optional - will replace existing if provided):</label>
                <input type="file" id="newProductImages" name="newProductImages" multiple accept="image/*">
                <small>If you upload new images, current ones might be replaced depending on backend logic.</small>
            </div>
            <button type="submit">Update Product</button>
            <p class="error-message" id="edit-product-error"></p>
            <p class="success-message" id="edit-product-success" style="color: green;"></p>
        </form>
    `;

    const editForm = document.getElementById('edit-product-form') as HTMLFormElement | null;
    if (editForm) {
        editForm.addEventListener('submit', handleUpdateProduct);
    }
}

async function handleUpdateProduct(event: SubmitEvent) {
    event.preventDefault();
    if (!currentProductId) return;

    const errorElement = document.getElementById('edit-product-error');
    const successElement = document.getElementById('edit-product-success');
    if (errorElement) errorElement.textContent = '';
    if (successElement) successElement.textContent = '';

    const token = getToken();
    if (!token) {
        alert('Authentication required.');
        return;
    }

    // For PUT with FormData, fields not included are not sent.
    // If your backend expects all fields or handles partial updates, this is fine.
    // If backend replaces images if new ones are sent, and keeps old if not, that's ideal for MVP.
    const formData = new FormData();
    formData.append('name', (document.getElementById('name') as HTMLInputElement).value);
    formData.append('description', (document.getElementById('description') as HTMLTextAreaElement).value);
    formData.append('price', (document.getElementById('price') as HTMLInputElement).value);
    formData.append('category', (document.getElementById('category') as HTMLInputElement).value);
    formData.append('stock', (document.getElementById('stock') as HTMLInputElement).value);

    const newImageFilesInput = document.getElementById('newProductImages') as HTMLInputElement;
    if (newImageFilesInput.files && newImageFilesInput.files.length > 0) {
        for (let i = 0; i < newImageFilesInput.files.length; i++) {
            formData.append('productImages', newImageFilesInput.files[i]); // Use 'productImages' to match create
        }
    }
    // Note: We are not sending existing imageKeys. The backend PUT /products/:id
    // needs to be smart: if 'productImages' is in FormData, replace images. If not, keep existing ones.
    // Deleting specific existing images requires more complex UI (checkboxes next to each).

    try {
        const response = await fetch(`${API_BASE_URL}/products/${currentProductId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Failed to update product');
        }
        if (successElement) successElement.textContent = 'Product updated successfully!';
        setTimeout(() => {
            if (successElement) successElement.textContent = '';
            window.location.href = '/admin/products.html';
        }, 2000);
    } catch (error: any) {
        if (errorElement) errorElement.textContent = error.message;
        console.error("Update product error:", error);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    updateAdminNavOnEditPage();
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (productId && getToken()) { // Check token before fetching
        fetchProductForEdit(productId);
    } else if (!productId) {
        if (formContainer) formContainer.innerHTML = '<p>No product ID specified for editing.</p>';
    }
});