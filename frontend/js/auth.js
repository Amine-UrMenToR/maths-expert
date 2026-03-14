// ═══════════════════════════════════════
// Auth JS — Login & Register
// ═══════════════════════════════════════
import { api, saveAuth, getUser, isLoggedIn } from './api.js';

// Rediriger si déjà connecté
if (isLoggedIn()) {
    const user = getUser();
    window.location.href = user.role === 'professor'
        ? '/professor/dashboard.html'
        : '/student/dashboard.html';
}

// ── Toast ──
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container') || (() => {
        const c = document.createElement('div');
        c.id = 'toast-container'; c.className = 'toast-container';
        document.body.appendChild(c); return c;
    })();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ── Role Tabs ──
const tabs = document.querySelectorAll('.role-tab');
const roleInput = document.getElementById('role-input');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (roleInput) roleInput.value = tab.dataset.role;
    });
});

// ── Login Form ──
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button[type=submit]');
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        btn.disabled = true; btn.textContent = 'Connexion…';
        try {
            const { token, user } = await api.post('/auth/login', { email, password });
            saveAuth(token, user);
            window.location.href = user.role === 'professor'
                ? '/professor/dashboard.html'
                : '/student/dashboard.html';
        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false; btn.textContent = 'Se connecter';
        }
    });
}

// ── Register Form ──
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = registerForm.querySelector('button[type=submit]');
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm-password').value;
        const role = roleInput ? roleInput.value : 'student';

        if (password !== confirm) { showToast('Les mots de passe ne correspondent pas', 'error'); return; }
        if (password.length < 6) { showToast('Mot de passe trop court (min. 6 caractères)', 'error'); return; }

        btn.disabled = true; btn.textContent = 'Inscription…';
        try {
            const { token, user } = await api.post('/auth/register', { name, email, password, role });
            saveAuth(token, user);
            window.location.href = user.role === 'professor'
                ? '/professor/dashboard.html'
                : '/student/dashboard.html';
        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false; btn.textContent = "S'inscrire";
        }
    });
}
