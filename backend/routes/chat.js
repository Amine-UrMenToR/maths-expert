const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/chat/groups
  router.get('/groups', authenticateToken, (req, res) => {
    let groups;
    if (req.user.role === 'professor') {
      groups = db.prepare(`
        SELECT g.*, u.name as professor_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
        FROM groups g JOIN users u ON g.professor_id = u.id
        WHERE g.professor_id = ? ORDER BY g.created_at DESC
      `).all(req.user.id);
    } else {
      groups = db.prepare(`
        SELECT g.*, u.name as professor_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
        FROM groups g JOIN group_members gm ON gm.group_id = g.id
        JOIN users u ON g.professor_id = u.id WHERE gm.user_id = ? ORDER BY g.created_at DESC
      `).all(req.user.id);
    }
    res.json(groups);
  });

  // POST /api/chat/groups
  router.post('/groups', authenticateToken, requireRole('professor'), (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom du groupe requis' });
    const result = db.prepare('INSERT INTO groups (name, description, professor_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.user.id);
    res.json({ id: result.lastInsertRowid, name, description, professor_id: req.user.id });
  });

  // GET /api/chat/groups/:id/members
  router.get('/groups/:id/members', authenticateToken, (req, res) => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, gm.joined_at
      FROM users u JOIN group_members gm ON gm.user_id = u.id WHERE gm.group_id = ?
    `).all(req.params.id);
    res.json(members);
  });

  // GET /api/chat/groups/:id/messages
  router.get('/groups/:id/messages', authenticateToken, (req, res) => {
    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = ? ORDER BY m.created_at ASC LIMIT 100
    `).all(req.params.id);
    res.json(messages);
  });

  // POST /api/chat/groups/:id/invite
  router.post('/groups/:id/invite', authenticateToken, requireRole('professor'), (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'ID étudiant requis' });
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(req.params.id, student_id);
    res.json({ success: true });
  });

  // POST /api/chat/groups/:id/join
  router.post('/groups/:id/join', authenticateToken, requireRole('student'), (req, res) => {
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // DELETE /api/chat/groups/:id/leave
  router.delete('/groups/:id/leave', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // DELETE /api/chat/groups/:id
  router.delete('/groups/:id', authenticateToken, requireRole('professor'), (req, res) => {
    db.prepare('DELETE FROM groups WHERE id = ? AND professor_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // GET /api/chat/conversations
  router.get('/conversations', authenticateToken, (req, res) => {
    const uid = req.user.id;
    const conversations = db.prepare(`
      SELECT DISTINCT
        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_id,
        u.name as other_name, u.role as other_role
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
      WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.group_id IS NULL
    `).all(uid, uid, uid, uid);

    const result = conversations.map(c => {
      const lastMsg = db.prepare(`
        SELECT content, created_at FROM messages
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND group_id IS NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(uid, c.other_id, c.other_id, uid);
      return { ...c, last_message: lastMsg?.content, last_message_at: lastMsg?.created_at };
    });
    res.json(result);
  });

  // GET /api/chat/private/:userId
  router.get('/private/:userId', authenticateToken, (req, res) => {
    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)) AND m.group_id IS NULL
      ORDER BY m.created_at ASC LIMIT 100
    `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);
    res.json(messages);
  });

  // GET /api/chat/professors
  router.get('/professors', authenticateToken, requireRole('student'), (req, res) => {
    const professors = db.prepare("SELECT id, name, email FROM users WHERE role = 'professor'").all();
    res.json(professors);
  });

  // GET /api/chat/available-groups
  router.get('/available-groups', authenticateToken, requireRole('student'), (req, res) => {
    const groups = db.prepare(`
      SELECT g.*, u.name as professor_name,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) as is_member
      FROM groups g JOIN users u ON g.professor_id = u.id ORDER BY g.created_at DESC
    `).all(req.user.id);
    res.json(groups);
  });

  return router;
};
