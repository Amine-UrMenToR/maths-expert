const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

module.exports = function (db) {
    const router = express.Router();

    // GET /api/courses — tous les cours
    router.get('/', (req, res) => {
        const courses = db.prepare(`
      SELECT c.*, u.name as professor_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
      FROM courses c JOIN users u ON c.professor_id = u.id ORDER BY c.created_at DESC
    `).all();
        res.json(courses);
    });

    // GET /api/courses/videos/all — toutes les vidéos
    router.get('/videos/all', (req, res) => {
        const videos = db.prepare(`
      SELECT v.*, u.name as professor_name, c.title as course_title
      FROM videos v JOIN users u ON v.professor_id = u.id
      LEFT JOIN courses c ON v.course_id = c.id ORDER BY v.created_at DESC
    `).all();
        res.json(videos);
    });

    // GET /api/courses/my/enrolled — mes cours inscrits (étudiant)
    router.get('/my/enrolled', authenticateToken, requireRole('student'), (req, res) => {
        const courses = db.prepare(`
      SELECT c.*, u.name as professor_name
      FROM courses c JOIN enrollments e ON e.course_id = c.id
      JOIN users u ON c.professor_id = u.id WHERE e.student_id = ?
    `).all(req.user.id);
        res.json(courses);
    });

    // GET /api/courses/my/courses — mes cours (professeur)
    router.get('/my/courses', authenticateToken, requireRole('professor'), (req, res) => {
        const courses = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
      FROM courses c WHERE c.professor_id = ? ORDER BY c.created_at DESC
    `).all(req.user.id);
        res.json(courses);
    });

    // GET /api/courses/my/videos — mes vidéos (professeur)
    router.get('/my/videos', authenticateToken, requireRole('professor'), (req, res) => {
        const videos = db.prepare(`
      SELECT v.*, c.title as course_title FROM videos v
      LEFT JOIN courses c ON v.course_id = c.id WHERE v.professor_id = ? ORDER BY v.created_at DESC
    `).all(req.user.id);
        res.json(videos);
    });

    // POST /api/courses — créer un cours (professeur)
    router.post('/', authenticateToken, requireRole('professor'), (req, res) => {
        const { title, description, content, level } = req.body;
        if (!title) return res.status(400).json({ error: 'Titre requis' });
        const result = db.prepare(
            'INSERT INTO courses (title, description, content, level, professor_id) VALUES (?, ?, ?, ?, ?)'
        ).run(title, description || '', content || '', level || 'Débutant', req.user.id);
        res.json({ id: result.lastInsertRowid, title, description, level, professor_id: req.user.id });
    });

    // DELETE /api/courses/:id
    router.delete('/:id', authenticateToken, requireRole('professor'), (req, res) => {
        const course = db.prepare('SELECT * FROM courses WHERE id = ? AND professor_id = ?').get(req.params.id, req.user.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    });

    // GET /api/courses/:id — détails d'un cours
    router.get('/:id', (req, res) => {
        const course = db.prepare(`
      SELECT c.*, u.name as professor_name FROM courses c JOIN users u ON c.professor_id = u.id WHERE c.id = ?
    `).get(req.params.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const videos = db.prepare('SELECT * FROM videos WHERE course_id = ? ORDER BY created_at').all(req.params.id);
        res.json({ ...course, videos });
    });

    // POST /api/courses/video/upload
    router.post('/video/upload', authenticateToken, requireRole('professor'), upload.single('video'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });
        const { title, description, course_id } = req.body;
        if (!title) return res.status(400).json({ error: 'Titre requis' });
        const result = db.prepare(
            'INSERT INTO videos (title, description, filename, course_id, professor_id) VALUES (?, ?, ?, ?, ?)'
        ).run(title, description || '', req.file.filename, course_id || null, req.user.id);
        res.json({ id: result.lastInsertRowid, title, filename: req.file.filename });
    });

    // POST /api/courses/:id/enroll
    router.post('/:id/enroll', authenticateToken, requireRole('student'), (req, res) => {
        try {
            db.prepare('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)').run(req.user.id, req.params.id);
            res.json({ success: true });
        } catch { res.status(409).json({ error: 'Déjà inscrit' }); }
    });

    // DELETE /api/courses/:id/enroll
    router.delete('/:id/enroll', authenticateToken, requireRole('student'), (req, res) => {
        db.prepare('DELETE FROM enrollments WHERE student_id = ? AND course_id = ?').run(req.user.id, req.params.id);
        res.json({ success: true });
    });

    return router;
};
