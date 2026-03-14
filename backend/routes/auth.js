const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

module.exports = function (db) {
    const router = express.Router();

    // POST /api/auth/register
    router.post('/register', (req, res) => {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role)
            return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
        if (!['student', 'professor'].includes(role))
            return res.status(400).json({ error: 'Rôle invalide' });

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

        const hash = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        ).run(name, email, hash, role);

        const token = jwt.sign({ id: result.lastInsertRowid, name, email, role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: result.lastInsertRowid, name, email, role } });
    });

    // POST /api/auth/login
    router.post('/login', (req, res) => {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email et mot de passe requis' });

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
        if (user.is_banned) return res.status(403).json({ error: 'Votre compte a été suspendu' });

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    });

    return router;
};
