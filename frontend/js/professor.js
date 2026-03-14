// ═══════════════════════════════════════
// Professor JS — Dashboard, Upload, Students
// ═══════════════════════════════════════
import { api, getUser, requireAuth, clearAuth } from './api.js';

requireAuth('professor');
const user = getUser();

export function showToast(msg, type = 'success') {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    c.appendChild(t); setTimeout(() => t.remove(), 4000);
}

document.querySelectorAll('.user-name').forEach(el => el.textContent = user.name);
document.querySelectorAll('.user-role').forEach(el => el.textContent = 'Professeur');
document.querySelectorAll('.user-avatar-letter').forEach(el => el.textContent = user.name[0].toUpperCase());
document.getElementById('logout-btn')?.addEventListener('click', () => { clearAuth(); window.location.href = '/login.html'; });

// ═══════════════════════════════════════
// PAGE: DASHBOARD PROF
// ═══════════════════════════════════════
async function loadProfDashboard() {
    if (!document.getElementById('my-courses-count')) return;
    try {
        const [courses, videos, students] = await Promise.all([
            api.get('/courses/my/courses'),
            api.get('/courses/my/videos'),
            api.get('/students')
        ]);
        document.getElementById('my-courses-count').textContent = courses.length;
        document.getElementById('my-videos-count').textContent = videos.length;
        document.getElementById('total-students').textContent = students.length;
        const totalEnrolled = courses.reduce((s, c) => s + (c.enrolled_count || 0), 0);
        document.getElementById('total-enrolled').textContent = totalEnrolled;

        // Mes cours récents
        const coursesEl = document.getElementById('recent-my-courses');
        if (coursesEl) {
            coursesEl.innerHTML = courses.length === 0
                ? `<div class="empty-state"><div class="empty-icon">📚</div><h4>Aucun cours créé</h4><a href="upload.html" class="btn btn-primary btn-sm">Créer un cours</a></div>`
                : courses.slice(0, 4).map(renderMyCourseRow).join('');
        }
    } catch (e) { console.error(e); }
}

function renderMyCourseRow(c) {
    return `
  <tr>
    <td><strong>${c.title}</strong></td>
    <td><span class="badge badge-primary">${c.level || 'Débutant'}</span></td>
    <td>${c.enrolled_count || 0} étudiants</td>
    <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
    <td>
      <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id})">🗑 Supprimer</button>
    </td>
  </tr>`;
}

// ═══════════════════════════════════════
// PAGE: UPLOAD
// ═══════════════════════════════════════
async function loadUploadPage() {
    const courseForm = document.getElementById('course-form');
    const videoForm = document.getElementById('video-form');
    if (!courseForm && !videoForm) return;

    // Charger mes cours pour les sélectionner lors d'un upload vidéo
    try {
        const courses = await api.get('/courses/my/courses');
        const selects = document.querySelectorAll('select[name="course_id"]');
        selects.forEach(sel => {
            sel.innerHTML = `<option value="">Aucun (vidéo indépendante)</option>` +
                courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        });
    } catch (e) { }

    // Créer un cours
    courseForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = courseForm.querySelector('button[type=submit]');
        const title = document.getElementById('course-title').value.trim();
        const description = document.getElementById('course-desc').value.trim();
        const content = document.getElementById('course-content').value.trim();
        const level = document.getElementById('course-level').value;
        btn.disabled = true; btn.textContent = 'Enregistrement…';
        try {
            await api.post('/courses', { title, description, content, level });
            showToast('Cours créé avec succès ! 🎉');
            courseForm.reset();
            loadMyCoursesTable();
        } catch (e) { showToast(e.message, 'error'); }
        btn.disabled = false; btn.textContent = 'Publier le cours';
    });

    // Upload vidéo
    videoForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = videoForm.querySelector('button[type=submit]');
        const title = document.getElementById('video-title').value.trim();
        const desc = document.getElementById('video-desc').value.trim();
        const fileInput = document.getElementById('video-file');
        const courseId = document.querySelector('select[name="course_id"]')?.value;
        if (!fileInput.files[0]) { showToast('Veuillez choisir un fichier vidéo', 'error'); return; }

        const fd = new FormData();
        fd.append('video', fileInput.files[0]);
        fd.append('title', title);
        fd.append('description', desc);
        if (courseId) fd.append('course_id', courseId);

        btn.disabled = true;
        const bar = document.getElementById('upload-progress');
        if (bar) bar.classList.remove('hidden');
        try {
            await api.upload('/courses/video/upload', fd);
            showToast('Vidéo uploadée avec succès ! 🎥');
            videoForm.reset();
            if (bar) bar.classList.add('hidden');
            loadMyVideosTable();
        } catch (err) { showToast(err.message, 'error'); if (bar) bar.classList.add('hidden'); }
        btn.disabled = false;
        btn.textContent = 'Uploader la vidéo';
    });

    // Drag & drop
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault(); dropZone.classList.remove('dragging');
            const file = e.dataTransfer.files[0];
            if (file) { document.getElementById('video-file').files = e.dataTransfer.files; dropZone.querySelector('h4').textContent = file.name; }
        });
        dropZone.addEventListener('click', () => document.getElementById('video-file').click());
    }

    loadMyCoursesTable();
    loadMyVideosTable();
}

async function loadMyCoursesTable() {
    const tbody = document.getElementById('my-courses-tbody');
    if (!tbody) return;
    try {
        const courses = await api.get('/courses/my/courses');
        tbody.innerHTML = courses.length === 0
            ? `<tr><td colspan="5" class="text-center text-muted">Aucun cours créé</td></tr>`
            : courses.map(renderMyCourseRow).join('');
    } catch (e) { }
}

async function loadMyVideosTable() {
    const tbody = document.getElementById('my-videos-tbody');
    if (!tbody) return;
    try {
        const videos = await api.get('/courses/my/videos');
        tbody.innerHTML = videos.length === 0
            ? `<tr><td colspan="4" class="text-muted text-center">Aucune vidéo uploadée</td></tr>`
            : videos.map(v => `
        <tr>
          <td><strong>${v.title}</strong></td>
          <td>${v.course_title || '—'}</td>
          <td>${new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
          <td><a href="/uploads/${v.filename}" target="_blank" class="btn btn-outline btn-sm">Voir</a></td>
        </tr>`).join('');
    } catch (e) { }
}

window.deleteCourse = async (id) => {
    if (!confirm('Supprimer ce cours ?')) return;
    try { await api.delete(`/courses/${id}`); showToast('Cours supprimé'); loadMyCoursesTable(); loadProfDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
};

// ═══════════════════════════════════════
// PAGE: GESTION ÉTUDIANTS
// ═══════════════════════════════════════
async function loadStudentsPage() {
    const container = document.getElementById('students-tbody');
    if (!container) return;
    try {
        const students = await api.get('/students');
        renderStudents(students);
        document.getElementById('student-search')?.addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#students-tbody tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    } catch (e) { container.innerHTML = `<tr><td colspan="5">Erreur chargement</td></tr>`; }
}

function renderStudents(students) {
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;
    tbody.innerHTML = students.length === 0
        ? `<tr><td colspan="5" class="text-center text-muted">Aucun étudiant inscrit</td></tr>`
        : students.map(s => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="user-avatar" style="width:36px;height:36px;font-size:.85rem;">${s.name[0]}</div>
          <div><div class="font-semibold">${s.name}</div><div class="text-xs text-muted">${s.email}</div></div>
        </div>
      </td>
      <td>${s.enrolled_courses} cours</td>
      <td>${new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
      <td>${s.is_banned
                ? `<span class="badge badge-danger">Suspendu</span>`
                : `<span class="badge badge-success">Actif</span>`}
      </td>
      <td>
        ${s.is_banned
                ? `<button class="btn btn-success btn-sm" onclick="unbanStudent(${s.id}, this)">✅ Réactiver</button>`
                : `<button class="btn btn-danger btn-sm" onclick="banStudent(${s.id}, this)">🚫 Bannir</button>`
            }
      </td>
    </tr>`).join('');
}

window.banStudent = async (id, btn) => {
    if (!confirm('Suspendre cet étudiant ?')) return;
    btn.disabled = true;
    try { await api.post(`/students/${id}/ban`, {}); showToast('Étudiant suspendu'); loadStudentsPage(); }
    catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
};
window.unbanStudent = async (id, btn) => {
    btn.disabled = true;
    try { await api.post(`/students/${id}/unban`, {}); showToast('Étudiant réactivé'); loadStudentsPage(); }
    catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
};

// ── Init ──
loadProfDashboard();
loadUploadPage();
loadStudentsPage();
