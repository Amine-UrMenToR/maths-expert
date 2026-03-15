// ═══════════════════════════════════════
// Chat JS — Groupes + Privé (Socket.io)
// ═══════════════════════════════════════
import { getToken, getUser, requireAuth } from './api.js';

requireAuth();
const user = getUser();
const token = getToken();

import { API_BASE } from './api.js';

// Get just the base URL by removing '/api'. If API_BASE is just '/api' (Vercel proxy), use origin.
const socketUrl = API_BASE === '/api' ? window.location.origin : API_BASE.replace(/\/api$/, '');
// Socket.io (chargé via CDN dans le HTML)
const socket = io(socketUrl, { auth: { token } });

let currentChat = null; // { type: 'group'|'private', id, name }

// ─── Utilitaires ────────────────────────
function formatTime(dt) {
    return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dt) {
    return new Date(dt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
function initials(name) { return (name || '?')[0].toUpperCase(); }
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── User Info ───────────────────────────
document.querySelectorAll('.user-name').forEach(el => el.textContent = user.name);
document.querySelectorAll('.user-role').forEach(el => el.textContent = user.role === 'professor' ? 'Professeur' : 'Étudiant');
document.querySelectorAll('.user-avatar-letter').forEach(el => el.textContent = initials(user.name));

// ─── Socket Events ───────────────────────
socket.on('connect', () => console.log('[Chat] Connecté'));
socket.on('disconnect', () => console.log('[Chat] Déconnecté'));

socket.on('new_message', (msg) => {
    if (currentChat?.type === 'group' && parseInt(currentChat.id) === parseInt(msg.group_id)) {
        appendMessage(msg);
    }
});

socket.on('new_private_message', (msg) => {
    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    if (currentChat?.type === 'private' && parseInt(currentChat.id) === parseInt(otherId)) {
        appendMessage(msg);
    }
    loadConversations();
});

// ─── Load Chats ──────────────────────────
async function loadGroups() {
    try {
        const res = await fetch('/api/chat/groups', { headers: { Authorization: `Bearer ${token}` } });
        const groups = await res.json();
        const list = document.getElementById('groups-list');
        if (!list) return;
        list.innerHTML = groups.length === 0
            ? `<div class="empty-state" style="padding:2rem"><div class="empty-icon">👥</div><p>Aucun groupe</p></div>`
            : groups.map(g => `
        <div class="chat-item" id="gc-${g.id}" onclick="openGroup(${g.id}, '${escapeHtml(g.name)}', ${g.member_count})">
          <div class="chat-avatar group">${initials(g.name)}</div>
          <div class="chat-info">
            <div class="chat-name">${g.name}</div>
            <div class="chat-last-msg">👥 ${g.member_count} membres</div>
          </div>
        </div>`).join('');
    } catch (e) { console.error(e); }
}

async function loadConversations() {
    try {
        const res = await fetch('/api/chat/conversations', { headers: { Authorization: `Bearer ${token}` } });
        const convs = await res.json();
        const list = document.getElementById('privates-list');
        if (!list) return;
        list.innerHTML = convs.length === 0
            ? `<div class="empty-state" style="padding:2rem"><div class="empty-icon">💬</div><p>Aucune conversation</p></div>`
            : convs.map(c => `
        <div class="chat-item" id="pc-${c.other_id}" onclick="openPrivate(${c.other_id}, '${escapeHtml(c.other_name)}')">
          <div class="chat-avatar ${c.other_role === 'professor' ? 'professor' : 'private'}">${initials(c.other_name)}</div>
          <div class="chat-info">
            <div class="chat-name">${c.other_name}</div>
            <div class="chat-last-msg">${c.last_message ? escapeHtml(c.last_message) : 'Aucun message'}</div>
          </div>
          <div class="chat-time">${c.last_message_at ? formatTime(c.last_message_at) : ''}</div>
        </div>`).join('');
    } catch (e) { console.error(e); }
}

// ─── Open Chats ─────────────────────────
window.openGroup = async (id, name, memberCount) => {
    currentChat = { type: 'group', id, name };
    setActiveChat(`gc-${id}`);
    renderChatHeader(name, `👥 ${memberCount} membres`, 'group');
    socket.emit('join_group', id);
    await loadGroupMessages(id);
    await loadGroupMembers(id);
};

window.openPrivate = async (id, name) => {
    currentChat = { type: 'private', id, name };
    setActiveChat(`pc-${id}`);
    renderChatHeader(name, 'Chat privé', 'private');
    await loadPrivateMessages(id);
    hideMembersPanel();
};

function setActiveChat(activeId) {
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    document.getElementById(activeId)?.classList.add('active');
    document.getElementById('chat-empty-state')?.classList.add('hidden');
    document.getElementById('chat-active')?.classList.remove('hidden');
}

function renderChatHeader(name, sub, type) {
    const avatar = type === 'group' ? '👥' : '👤';
    document.getElementById('chat-header-name').textContent = name;
    document.getElementById('chat-header-sub').textContent = sub;
}

// ─── Messages ───────────────────────────
async function loadGroupMessages(groupId) {
    clearMessages();
    const res = await fetch(`/api/chat/groups/${groupId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
    const msgs = await res.json();
    msgs.forEach(appendMessage);
    scrollBottom();
}

async function loadPrivateMessages(userId) {
    clearMessages();
    const res = await fetch(`/api/chat/private/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
    const msgs = await res.json();
    msgs.forEach(appendMessage);
    scrollBottom();
}

function clearMessages() {
    const container = document.getElementById('messages-container');
    if (container) container.innerHTML = '';
}

function appendMessage(msg) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    const isSent = msg.sender_id === user.id;
    const senderInitial = initials(msg.sender_name);
    const avatarClass = msg.sender_role === 'professor' ? 'prof-color' : '';

    const div = document.createElement('div');
    div.className = `msg ${isSent ? 'sent' : 'received'}`;
    div.innerHTML = `
    ${!isSent ? `<div class="msg-avatar ${avatarClass}">${senderInitial}</div>` : ''}
    <div class="msg-content">
      ${!isSent ? `<div class="msg-sender">${msg.sender_name}${msg.sender_role === 'professor' ? ' 👩‍🏫' : ''}</div>` : ''}
      <div class="msg-bubble">${escapeHtml(msg.content)}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>
    ${isSent ? `<div class="msg-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent))">${initials(user.name)}</div>` : ''}
  `;
    container.appendChild(div);
    scrollBottom();
}

function scrollBottom() {
    const container = document.getElementById('messages-container');
    if (container) container.scrollTop = container.scrollHeight;
}

// ─── Envoyer un message ──────────────────
document.getElementById('send-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

document.getElementById('msg-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

function sendMessage() {
    const input = document.getElementById('msg-input');
    const content = input?.value.trim();
    if (!content || !currentChat) return;
    input.value = '';
    input.style.height = 'auto';

    if (currentChat.type === 'group') {
        socket.emit('group_message', { group_id: currentChat.id, content });
    } else {
        socket.emit('private_message', { receiver_id: currentChat.id, content });
    }
}

// Auto-resize textarea
document.getElementById('msg-input')?.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ─── Membres d'un groupe ─────────────────
async function loadGroupMembers(groupId) {
    const panel = document.getElementById('members-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    const list = document.getElementById('members-list');
    try {
        const res = await fetch(`/api/chat/groups/${groupId}/members`, { headers: { Authorization: `Bearer ${token}` } });
        const members = await res.json();
        list.innerHTML = members.map(m => `
      <div class="member-item">
        <div class="member-avatar">${initials(m.name)}</div>
        <div class="member-name">${m.name}</div>
        <div class="member-role ${m.role === 'professor' ? 'prof-tag' : ''}">${m.role === 'professor' ? '👩‍🏫' : '🎓'}</div>
      </div>`).join('');
    } catch (e) { }
}

function hideMembersPanel() {
    document.getElementById('members-panel')?.classList.add('hidden');
}

// ─── Créer un groupe (Professeur) ────────
document.getElementById('create-group-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name-input').value.trim();
    const desc = document.getElementById('group-desc-input')?.value.trim();
    if (!name) return;
    try {
        await fetch('/api/chat/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name, description: desc })
        });
        closeModal('create-group-modal');
        loadGroups();
    } catch (e) { }
});

// ─── Inviter un étudiant (Professeur) ────
document.getElementById('invite-student-btn')?.addEventListener('click', async () => {
    if (!currentChat || currentChat.type !== 'group') { alert('Ouvrez un groupe d\'abord'); return; }
    try {
        const res = await fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } });
        const students = await res.json();
        const sel = document.getElementById('invite-student-select');
        if (sel) sel.innerHTML = students.filter(s => !s.is_banned).map(s => `<option value="${s.id}">${s.name} — ${s.email}</option>`).join('');
        openModal('invite-student-modal');
    } catch (e) { }
});

document.getElementById('invite-confirm-btn')?.addEventListener('click', async () => {
    const studentId = document.getElementById('invite-student-select')?.value;
    if (!studentId || !currentChat) return;
    try {
        await fetch(`/api/chat/groups/${currentChat.id}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ student_id: studentId })
        });
        closeModal('invite-student-modal');
        loadGroupMembers(currentChat.id);
        showToast('Étudiant ajouté au groupe');
    } catch (e) { }
});

// ─── Rejoindre un groupe (Étudiant) ──────
async function loadAvailableGroups() {
    const container = document.getElementById('available-groups');
    if (!container) return;
    try {
        const res = await fetch('/api/chat/available-groups', { headers: { Authorization: `Bearer ${token}` } });
        const groups = await res.json();
        container.innerHTML = groups.length === 0
            ? `<p class="text-muted text-sm">Aucun groupe disponible</p>`
            : groups.map(g => `
        <div class="flex items-center justify-between" style="padding:.6rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div class="font-semibold text-sm">${g.name}</div>
            <div class="text-xs text-muted">👤 ${g.professor_name} · 👥 ${g.member_count}</div>
          </div>
          ${g.is_member
                    ? `<span class="badge badge-success">Membre</span>`
                    : `<button class="btn btn-primary btn-sm" onclick="joinGroup(${g.id})">Rejoindre</button>`}
        </div>`).join('');
    } catch (e) { }
}

window.joinGroup = async (id) => {
    try {
        await fetch(`/api/chat/groups/${id}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        loadGroups(); loadAvailableGroups(); showToast('Groupe rejoint !');
    } catch (e) { }
};

// ─── Charger les professeurs pour messages privés (Étudiant) ──
async function loadProfessors() {
    const container = document.getElementById('professors-list');
    if (!container) return;
    try {
        const res = await fetch('/api/chat/professors', { headers: { Authorization: `Bearer ${token}` } });
        const profs = await res.json();
        container.innerHTML = profs.length === 0
            ? `<p class="text-muted text-sm">Aucun professeur disponible</p>`
            : profs.map(p => `
        <div class="chat-item" onclick="openPrivate(${p.id}, '${escapeHtml(p.name)}')">
          <div class="chat-avatar professor">${initials(p.name)}</div>
          <div class="chat-info">
            <div class="chat-name">${p.name}</div>
            <div class="chat-last-msg">👩‍🏫 Professeur</div>
          </div>
        </div>`).join('');
    } catch (e) { }
}

// ─── Modal helpers ───────────────────────
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); }
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); }
}
window.openModal = openModal;
window.closeModal = closeModal;

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ─── Toast ───────────────────────────────
function showToast(msg, type = 'success') {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    c.appendChild(t); setTimeout(() => t.remove(), 4000);
}
window.showToast = showToast;

// ─── Logout ──────────────────────────────
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('me_token'); localStorage.removeItem('me_user');
    window.location.href = '/login.html';
});

// ─── Init ────────────────────────────────
loadGroups();
loadConversations();
loadAvailableGroups();
loadProfessors();

// Rafraîchissement périodique
setInterval(loadConversations, 15000);
