// ═══════════════════════════════════════
// API Helper — Maths Expert
// ═══════════════════════════════════════

// Define API base url based on location
// For production, replace the 'YOUR_RENDER_URL' string with the actual Render app backend URL 
const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const PROD_API_URL = 'YOUR_RENDER_URL_HERE/api'; 
const DEV_API_URL = 'http://localhost:3000/api';
export const API_BASE = isProd ? PROD_API_URL : DEV_API_URL;


let _token = localStorage.getItem('me_token');
let _user = JSON.parse(localStorage.getItem('me_user') || 'null');

export const getToken = () => _token;
export const getUser = () => _user;
export const isLoggedIn = () => !!_token;

export function saveAuth(token, user) {
    _token = token; _user = user;
    localStorage.setItem('me_token', token);
    localStorage.setItem('me_user', JSON.stringify(user));
}

export function clearAuth() {
    _token = null; _user = null;
    localStorage.removeItem('me_token');
    localStorage.removeItem('me_user');
}

export function requireAuth(role) {
    if (!_token || !_user) { window.location.href = '/login.html'; return false; }
    if (role && _user.role !== role) {
        window.location.href = _user.role === 'professor' ? '/professor/dashboard.html' : '/student/dashboard.html';
        return false;
    }
    return true;
}

async function request(method, path, body, isFormData = false) {
    const headers = {};
    if (_token) headers['Authorization'] = `Bearer ${_token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const res = await fetch(API_BASE + path, {
        method,
        headers,
        body: isFormData ? body : (body ? JSON.stringify(body) : undefined)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
}

export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
    upload: (path, formData) => request('POST', path, formData, true),
};
