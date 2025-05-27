// frontend/admin/ts/adminOrders.ts
import { API_BASE_URL, getToken, removeToken } from '../../ts/main.js'; // Correct path

// --- Elements for Order List Page (orders.html) ---
const orderListContainer = document.getElementById('admin-order-list');

// --- Elements for Order Detail Page (order-detail.html) ---
const orderDetailContainer = document.getElementById('admin-order-detail-content');
const updateStatusSection = document.getElementById('update-status-section');
const orderStatusSelect = document.getElementById('orderStatus') as HTMLSelectElement | null;
const updateStatusBtn = document.getElementById('update-status-btn');
const statusUpdateMessageEl = document.getElementById('status-update-message');

// --- Shared Admin Nav ---
const authLinksAdminContainer = document.getElementById('auth-links-admin');
let currentAdminOrderId: string | null = null; // To store ID for detail page actions

function updateAdminNavOnOrderPages() {
    const token = getToken();
    if (authLinksAdminContainer) {
        if (token) {
            authLinksAdminContainer.innerHTML = `<a href="#" id="admin-logout-link-orderspage">Admin Logout</a>`;
            document.getElementById('admin-logout-link-orderspage')?.addEventListener('click', (e) => {
                e.preventDefault(); removeToken(); alert('Logged out.'); window.location.href = '/login.html';
            });
        } else {
            // Redirect to login, preserving the current admin page URL to come back to
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
    }
}

// --- Logic for Order List Page (orders.html) ---
async function fetchAdminOrders() {
    if (!orderListContainer) return;
    const token = getToken();
    if (!token) { // Should be caught by updateAdminNav, but good to check
        orderListContainer.innerHTML = '<p>Authentication required. Please log in.</p>';
        return;
    }
    orderListContainer.innerHTML = '<p>Loading orders...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders?limit=50`, { // Added limit
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                removeToken(); // Token might be invalid or user not admin
                alert('Access Denied. Please log in as an admin.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            } else {
                const errorData = await response.json().catch(() => ({ message: `HTTP Error: ${response.status}` }));
                throw new Error(errorData.message);
            }
            return;
        }
        const result = await response.json();
        if (result.data && Array.isArray(result.data)) {
            renderAdminOrders(result.data);
        } else {
            throw new Error("Unexpected response structure for orders.");
        }
    } catch (error: any) {
        orderListContainer.innerHTML = `<p>Error loading orders: ${error.message}</p>`;
        console.error("Fetch admin orders error:", error);
    }
}

function renderAdminOrders(orders: any[]) {
    if (!orderListContainer) return; // Should not happen if called correctly
    if (orders.length === 0) {
        orderListContainer.innerHTML = '<p>No orders found.</p>';
        return;
    }
    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date Placed</th>
                    <th>Total Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(order => `
                    <tr>
                        <td>${order._id}</td>
                        <td>${order.user?.name || 'N/A'} <br><small>(${order.user?.email || 'N/A'})</small></td>
                        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                        <td>$${order.totalPrice.toFixed(2)}</td>
                        <td><span class="status-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span></td>
                        <td class="actions"><a href="/admin/order-detail.html?id=${order._id}">View Details</a></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    orderListContainer.innerHTML = tableHtml;
}

// --- Logic for Order Detail Page (order-detail.html) ---
async function fetchAdminOrderDetail(orderId: string) {
    if (!orderDetailContainer) return;
    const token = getToken();
    if (!token) {
         orderDetailContainer.innerHTML = '<p>Authentication required. Please log in.</p>';
        return;
    }
    currentAdminOrderId = orderId; // Store for update status action
    orderDetailContainer.innerHTML = '<p>Loading order details...</p>';
    if (updateStatusSection) updateStatusSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
             if (response.status === 401 || response.status === 403) {
                removeToken();
                alert('Access Denied. Please log in as an admin.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            } else if (response.status === 404) {
                throw new Error('Order not found.');
            } else {
                const errorData = await response.json().catch(() => ({ message: `HTTP Error: ${response.status}` }));
                throw new Error(errorData.message);
            }
            return;
        }
        const result = await response.json();
        if (result.data) {
            renderAdminOrderDetail(result.data);
            if (updateStatusSection) updateStatusSection.style.display = 'block';
            if (orderStatusSelect) orderStatusSelect.value = result.data.status;
        } else {
             throw new Error("Unexpected response structure for order detail.");
        }
    } catch (error: any) {
        orderDetailContainer.innerHTML = `<p>Error loading order details: ${error.message}</p>`;
        console.error("Fetch admin order detail error:", error);
    }
}

function renderAdminOrderDetail(order: any) {
    if (!orderDetailContainer || !order) return;

    const itemsHtml = order.orderItems.map((item: any) => `
        <tr>
            <td>${item.name} <br><small>(Product ID: ${item.product})</small></td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${(item.quantity * item.price).toFixed(2)}</td>
        </tr>
    `).join('');

    const detailHtml = `
        <div class="order-section">
            <h3>Order Summary</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Current Status:</strong> <span id="current-order-status-detail">${order.status}</span></p>
            <p><strong>Date Placed:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
            <p><strong>Items Price:</strong> $${order.itemsPrice.toFixed(2)}</p>
            <p><strong>Shipping Price:</strong> $${order.shippingPrice.toFixed(2)}</p>
            <p><strong>Tax Price:</strong> $${order.taxPrice.toFixed(2)}</p>
            <p><strong>Total Amount:</strong> $${order.totalPrice.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Is Paid:</strong> ${order.isPaid ? `Yes, at ${new Date(order.paidAt).toLocaleString()}` : 'No'}</p>
            ${order.shippedAt ? `<p><strong>Shipped At:</strong> ${new Date(order.shippedAt).toLocaleString()}</p>` : ''}
            ${order.deliveredAt ? `<p><strong>Delivered At:</strong> ${new Date(order.deliveredAt).toLocaleString()}</p>` : ''}
        </div>
        <div class="order-section">
            <h3>Customer Information</h3>
            <p><strong>User ID:</strong> ${order.user?._id || 'N/A'}</p>
            <p><strong>Name:</strong> ${order.user?.name || 'N/A'}</p>
            <p><strong>Email:</strong> ${order.user?.email || 'N/A'}</p>
        </div>
        <div class="order-section">
            <h3>Shipping Address</h3>
            <p>
                ${order.shippingAddress.address || ''}<br>
                ${order.shippingAddress.city || ''}, ${order.shippingAddress.postalCode || ''}<br>
                ${order.shippingAddress.country || ''}
            </p>
        </div>
        <div class="order-section">
            <h3>Order Items</h3>
            <table class="order-items-table">
                <thead><tr><th>Product Name (ID)</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
        </div>
    `;
    orderDetailContainer.innerHTML = detailHtml;
}

async function handleUpdateOrderStatus() {
    if (!currentAdminOrderId || !orderStatusSelect || !statusUpdateMessageEl || !updateStatusBtn) return;

    const newStatus = orderStatusSelect.value;
    const token = getToken();
    if (!token) {
        alert("Authentication error. Please log in again.");
        return;
    }

    statusUpdateMessageEl.textContent = 'Updating status...';
    statusUpdateMessageEl.style.color = 'inherit';
    (updateStatusBtn as HTMLButtonElement).disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${currentAdminOrderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await response.json();
        if (!response.ok) {
             if (response.status === 401 || response.status === 403) removeToken();
            throw new Error(result.message || 'Failed to update order status');
        }

        statusUpdateMessageEl.textContent = `Order status successfully updated to "${newStatus}"!`;
        statusUpdateMessageEl.style.color = 'green';

        // Update the status display on the page without full re-fetch
        const currentStatusDisplay = document.getElementById('current-order-status-detail');
        if (currentStatusDisplay) currentStatusDisplay.textContent = newStatus;
        // If you added/updated deliveredAt/shippedAt, you might want to refresh the whole detail view:
        // fetchAdminOrderDetail(currentAdminOrderId);

    } catch (error: any) {
        statusUpdateMessageEl.textContent = `Error: ${error.message}`;
        statusUpdateMessageEl.style.color = 'red';
        console.error("Update order status error:", error);
    } finally {
        (updateStatusBtn as HTMLButtonElement).disabled = false;
    }
}

// --- Page Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    updateAdminNavOnOrderPages(); // Handle auth and nav for both pages

    const currentPath = window.location.pathname;
    const tokenExists = getToken();

    if (tokenExists) { // Only proceed if token exists (nav function handles redirect if not)
        if (currentPath.includes('/admin/orders.html') && !currentPath.includes('/admin/order-detail.html')) {
            if (orderListContainer) fetchAdminOrders();
        } else if (currentPath.includes('/admin/order-detail.html')) {
            const params = new URLSearchParams(window.location.search);
            const orderId = params.get('id');
            if (orderId) {
                if (orderDetailContainer) fetchAdminOrderDetail(orderId);
                if (updateStatusBtn) {
                    updateStatusBtn.addEventListener('click', handleUpdateOrderStatus);
                }
            } else if (orderDetailContainer) {
                orderDetailContainer.innerHTML = '<p>No order ID specified in URL.</p>';
                if (updateStatusSection) updateStatusSection.style.display = 'none';
            }
        }
    }
});