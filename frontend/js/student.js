// ═══════════════════════════════════════
// Student JS — Dashboard & Courses
// ═══════════════════════════════════════
import { api, getUser, requireAuth, clearAuth } from './api.js';

requireAuth('student');
const user = getUser();

// ── Utilitaires ──
export function showToast(msg, type = 'success') {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ── Sidebar user info ──
document.querySelectorAll('.user-name').forEach(el => el.textContent = user.name);
document.querySelectorAll('.user-role').forEach(el => el.textContent = 'Étudiant');
document.querySelectorAll('.user-avatar-letter').forEach(el => el.textContent = user.name[0].toUpperCase());
document.getElementById('logout-btn')?.addEventListener('click', () => { clearAuth(); window.location.href = '/login.html'; });

// ═══════════════════════════════════════
// PAGE: DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
    if (!document.getElementById('enrolled-count')) return;
    try {
        const [enrolled, allCourses, videos] = await Promise.all([
            api.get('/courses/my/enrolled'),
            api.get('/courses'),
            api.get('/courses/videos/all')
        ]);
        document.getElementById('enrolled-count').textContent = enrolled.length;
        document.getElementById('total-courses').textContent = allCourses.length;
        document.getElementById('total-videos').textContent = videos.length;

        // Cours récents inscrits
        const container = document.getElementById('recent-courses');
        if (container) {
            if (enrolled.length === 0) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h4>Aucun cours inscrit</h4><p>Rejoignez des cours pour les voir ici</p><a href="courses.html" class="btn btn-primary btn-sm">Voir les cours</a></div>`;
            } else {
                container.innerHTML = enrolled.slice(0, 3).map(renderCourseCard).join('');
            }
        }
    } catch (e) { console.error(e); }
}

// ═══════════════════════════════════════
// PAGE: COURS
// ═══════════════════════════════════════
let enrolledIds = [];

async function loadCourses() {
    const container = document.getElementById('courses-container');
    const videosContainer = document.getElementById('videos-container');
    if (!container && !videosContainer) return;

    try {
        const [allCourses, enrolled, videos] = await Promise.all([
            api.get('/courses'),
            api.get('/courses/my/enrolled'),
            api.get('/courses/videos/all')
        ]);
        enrolledIds = enrolled.map(c => c.id);

        if (container) {
            if (allCourses.length === 0) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h4>Aucun cours disponible</h4><p>Les professeurs n'ont pas encore publié de cours</p></div>`;
            } else {
                container.innerHTML = allCourses.map(renderCourseCard).join('');
            }
        }
        if (videosContainer) {
            if (videos.length === 0) {
                videosContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">🎥</div><h4>Aucune vidéo disponible</h4></div>`;
            } else {
                videosContainer.innerHTML = videos.map(renderVideoCard).join('');
            }
        }
    } catch (e) { container && (container.innerHTML = '<p class="text-muted">Erreur lors du chargement</p>'); }
}

function renderCourseCard(course) {
    const enrolled = enrolledIds.includes(course.id);
    const icons = ['📐', '📊', '🔢', '∑', 'π', '√', '∫', '≡'];
    const icon = icons[course.id % icons.length];
    const levels = { 'Débutant': 'success', 'Intermédiaire': 'warning', 'Avancé': 'danger' };
    return `
  <div class="course-card">
    <div class="course-banner">
      <div class="banner-icon">${icon}</div>
      <span class="level-badge">${course.level || 'Débutant'}</span>
    </div>
    <div class="course-body">
      <h4>${course.title}</h4>
      <p>${course.description || 'Aucune description'}</p>
      <div class="course-meta">
        <span>👤 ${course.professor_name}</span>
        <span>👥 ${course.enrolled_count || 0} inscrits</span>
      </div>
    </div>
    <div class="course-actions">
      ${enrolled
            ? `<button class="btn btn-outline btn-sm" onclick="viewCourse(${course.id})">Voir le cours</button>
           <button class="btn btn-sm" style="color:var(--danger)" onclick="unenroll(${course.id})">Se désinscrire</button>`
            : `<button class="btn btn-primary btn-sm w-full" onclick="enroll(${course.id})">S'inscrire</button>`
        }
    </div>
  </div>`;
}

function renderVideoCard(v) {
    return `
  <div class="video-card">
    <div class="video-thumb">
      <video src="/uploads/${v.filename}" preload="none"></video>
      <div class="video-play-btn">▶</div>
    </div>
    <div class="video-body">
      <h4>${v.title}</h4>
      <p class="text-sm text-muted">${v.description || ''}</p>
      <div class="video-meta">
        <span>👤 ${v.professor_name}</span>
        ${v.course_title ? `<span>📚 ${v.course_title}</span>` : ''}
      </div>
    </div>
  </div>`;
}

window.enroll = async (courseId) => {
    try {
        await api.post(`/courses/${courseId}/enroll`, {});
        showToast('Inscription réussie ! 🎉');
        loadCourses();
    } catch (e) { showToast(e.message, 'error'); }
};

window.unenroll = async (courseId) => {
    try {
        await api.delete(`/courses/${courseId}/enroll`);
        showToast('Désinscription effectuée');
        loadCourses();
    } catch (e) { showToast(e.message, 'error'); }
};

window.viewCourse = (id) => window.location.href = `course-detail.html?id=${id}`;

// ── Filtres ──
document.getElementById('search-courses')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.course-card').forEach(card => {
        const title = card.querySelector('h4')?.textContent.toLowerCase();
        card.style.display = title?.includes(q) ? '' : 'none';
    });
});

// ── Init ──
loadDashboard();
loadCourses();
