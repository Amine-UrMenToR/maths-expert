const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

module.exports = function (db) {
    const router = express.Router();

    // GET /api/students
    router.get('/', authenticateToken, requireRole('professor'), (req, res) => {
        const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.is_banned, u.created_at,
      (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = u.id) as enrolled_courses
      FROM users u WHERE u.role = 'student' ORDER BY u.created_at DESC
    `).all();
        res.json(students);
    });

    // GET /api/students/course/:courseId
    router.get('/course/:courseId', authenticateToken, requireRole('professor'), (req, res) => {
        const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.is_banned, e.enrolled_at
      FROM users u JOIN enrollments e ON e.student_id = u.id
      WHERE e.course_id = ? AND u.role = 'student' ORDER BY e.enrolled_at DESC
    `).all(req.params.courseId);
        res.json(students);
    });

    // POST /api/students/:id/ban
    router.post('/:id/ban', authenticateToken, requireRole('professor'), (req, res) => {
        db.prepare("UPDATE users SET is_banned = 1 WHERE id = ? AND role = 'student'").run(req.params.id);
        res.json({ success: true, message: 'Étudiant suspendu' });
    });

    // POST /api/students/:id/unban
    router.post('/:id/unban', authenticateToken, requireRole('professor'), (req, res) => {
        db.prepare("UPDATE users SET is_banned = 0 WHERE id = ? AND role = 'student'").run(req.params.id);
        res.json({ success: true, message: 'Étudiant réactivé' });
    });

    // GET /api/students/me/profile
    router.get('/me/profile', authenticateToken, requireRole('student'), (req, res) => {
        const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
        const enrolled = db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE student_id = ?').get(req.user.id);
        res.json({ ...user, enrolled_courses: enrolled ? enrolled.count : 0 });
    });

    return router;
};
