// frontend/ts/auth.ts
import { API_BASE_URL, setToken, updateNavAndCart } from './main.js'; // Assuming updateNavAndCart is exported and used after login

const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
const registerForm = document.getElementById('register-form') as HTMLFormElement | null;
const loginErrorEl = document.getElementById('login-error');
const registerErrorEl = document.getElementById('register-error');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[auth.ts - login] Login form submitted.');
        if (loginErrorEl) loginErrorEl.textContent = '';

        // These IDs should match your login.html
        const emailEl = document.getElementById('email') as HTMLInputElement | null;
        const passwordEl = document.getElementById('password') as HTMLInputElement | null;

        if (!emailEl || !passwordEl) {
            console.error('[auth.ts - login] Email or password input field not found.');
            if (loginErrorEl) loginErrorEl.textContent = 'Login form error. Please refresh.';
            return;
        }
        const email = emailEl.value;
        const password = passwordEl.value;
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
                // Instead of direct redirect, call updateNavAndCart then redirect if needed
                // or rely on DOMContentLoaded on the new page.
                // Forcing a full reload which will trigger main.js on new page:
                window.location.href = '/'; 
            } else {
                 console.error('[auth.ts - login] Token NOT found or is invalid in response. Data was:', data);
                 throw new Error('Token not received from server or is invalid.');
            }
        } catch (error: any) {
            if (loginErrorEl) loginErrorEl.textContent = error.message;
            console.error('[auth.ts - login] Login catch block error:', error.message, error);
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[auth.ts - register] Register form submitted.');
        if (registerErrorEl) registerErrorEl.textContent = '';

        // Use the correct IDs from your register.html
        const nameEl = document.getElementById('name') as HTMLInputElement | null;
        const emailEl = document.getElementById('email-register') as HTMLInputElement | null;    // CORRECTED ID
        const passwordEl = document.getElementById('password-register') as HTMLInputElement | null; // CORRECTED ID

        if (!nameEl || !emailEl || !passwordEl) {
            console.error('[auth.ts - register] Name, email, or password input field not found.');
            if (registerErrorEl) registerErrorEl.textContent = 'Registration form error. Please refresh.';
            return;
        }

        const name = nameEl.value;
        const email = emailEl.value;
        const password = passwordEl.value;
        console.log('[auth.ts - register] Attempting registration for Email:', email);

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
        } catch (error: any) {
            if (registerErrorEl) registerErrorEl.textContent = error.message;
            console.error('[auth.ts - register] Registration catch block error:', error);
        }
    });
}