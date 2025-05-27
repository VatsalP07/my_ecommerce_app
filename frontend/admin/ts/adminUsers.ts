// frontend/admin/ts/adminUsers.ts
import { API_BASE_URL, getToken, removeToken } from '../../ts/main.js';

const userListContainer = document.getElementById('admin-user-list');
const authLinksAdminContainer = document.getElementById('auth-links-admin');

function updateAdminNavOnUsersPage() { /* ... same as other admin pages ... */
    const token = getToken();
    if (authLinksAdminContainer) {
        if (token) {
            authLinksAdminContainer.innerHTML = `<a href="#" id="admin-logout-link-users">Admin Logout</a>`;
            document.getElementById('admin-logout-link-users')?.addEventListener('click', (e) => { /* ... logout ... */ });
        } else {
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
    }
}

async function fetchAdminUsers() {
    if (!userListContainer || !getToken()) return;
    userListContainer.innerHTML = '<p>Loading users...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!response.ok) { /* ... error handling, redirect ... */ }
        const result = await response.json();
        renderAdminUsers(result.data);
    } catch (error) { /* ... */ }
}

function renderAdminUsers(users: any[]) {
    if (!userListContainer || !users) return;
    if (users.length === 0) { /* ... no users message ... */ return; }

    const tableHtml = `
        <table>
            <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Actions</th></tr></thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.roles.join(', ')}</td>
                        <td>
                            <select class="user-role-select" data-user-id="${user._id}">
                                <option value="customer" ${user.roles.includes('customer') && !user.roles.includes('seller') && !user.roles.includes('admin') ? 'selected' : ''}>Customer</option>
                                <option value="seller" ${user.roles.includes('seller') ? 'selected' : ''}>Seller</option>
                                <option value="admin" ${user.roles.includes('admin') ? 'selected' : ''}>Admin</option>
                            </select>
                            <button class="update-role-btn" data-user-id="${user._id}">Update Role</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    userListContainer.innerHTML = tableHtml;

    document.querySelectorAll('.update-role-btn').forEach(button => {
        button.addEventListener('click', handleUpdateUserRole);
    });
}

async function handleUpdateUserRole(event: Event) {
    const button = event.target as HTMLButtonElement;
    const userId = button.dataset.userId;
    const selectElement = button.previousElementSibling as HTMLSelectElement;
    const newRole = selectElement.value; // This gives a single role
    
    // For simplicity, we'll assign this single role.
    // A more complex UI would allow multiple role selection.
    // For this MVP, let's assume we want to make them *just* this role,
    // or add it if it's 'seller' or 'admin' on top of 'customer'.
    // Backend expects an array.
    let rolesToSet = ['customer']; // Always has customer role
    if (newRole === 'seller') rolesToSet.push('seller');
    if (newRole === 'admin') rolesToSet.push('admin');
    rolesToSet = [...new Set(rolesToSet)]; // Ensure unique roles

    if (!userId || !newRole) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ roles: rolesToSet })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update role');
        alert('User role updated!');
        fetchAdminUsers(); // Refresh
    } catch (error: any) { alert(`Error: ${error.message}`); }
}

document.addEventListener('DOMContentLoaded', () => {
    updateAdminNavOnUsersPage();
    if (getToken()) fetchAdminUsers();
});