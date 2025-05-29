// frontend/ts/auth.ts
import { API_BASE_URL, setToken } from './main.js';
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginErrorEl = document.getElementById('login-error');
const registerErrorEl = document.getElementById('register-error');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[auth.ts - login] Login form submitted.');
        if (loginErrorEl)
            loginErrorEl.textContent = '';
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        console.log('[auth.ts - login] Attempting login with Email:', email);
        try {
            console.log('[auth.ts - login] Fetching POST /api/v1/auth/login...');
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            console.log('[auth.ts - login] API response status:', response.status);
            const data = await response.json();
            console.log('[auth.ts - login] API response data:', data);
            if (!response.ok) {
                console.error('[auth.ts - login] API call not OK. Error data:', data);
                throw new Error(data.message || `Login failed with status ${response.status}`);
            }
            if (data && data.token && typeof data.token === 'string' && data.token.trim() !== '') {
                console.log('[auth.ts - login] Token found in response. Calling setToken.');
                setToken(data.token);
                alert('Login successful!');
                console.log('[auth.ts - login] Redirecting to / (homepage)...');
                window.location.href = '/'; // Homepage DOMContentLoaded will call updateNavAndCart
            }
            else {
                console.error('[auth.ts - login] Token NOT found or is invalid in response. Data was:', data);
                throw new Error('Token not received from server or is invalid.');
            }
        }
        catch (error) {
            if (loginErrorEl)
                loginErrorEl.textContent = error.message;
            console.error('[auth.ts - login] Login catch block error:', error.message, error);
        }
    });
}
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (registerErrorEl)
            registerErrorEl.textContent = '';
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || (data.errors ? data.errors.join(', ') : 'Registration failed'));
            }
            alert('Registration successful! Please login.');
            window.location.href = '/login.html';
        }
        catch (error) {
            if (registerErrorEl)
                registerErrorEl.textContent = error.message;
            console.error('[auth.ts] Registration error:', error);
        }
    });
}
