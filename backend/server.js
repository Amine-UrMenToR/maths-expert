const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { initDb } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Fichiers uploadés
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 3000;

// Initialiser la base de données, puis démarrer
initDb().then((db) => {
    // Passer db aux routes
    app.use('/api/auth', require('./routes/auth')(db));
    app.use('/api/courses', require('./routes/courses')(db));
    app.use('/api/students', require('./routes/students')(db));
    app.use('/api/chat', require('./routes/chat')(db));

    // Servir index.html pour les routes non-API
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    // ── SOCKET.IO — Chat en temps réel ──
    const connectedUsers = new Map();

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Non authentifié'));
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return next(new Error('Token invalide'));
            socket.user = user;
            next();
        });
    });

    io.on('connection', (socket) => {
        const user = socket.user;
        connectedUsers.set(user.id, socket.id);
        console.log(`[Socket] ${user.name} (${user.role}) connecté`);

        // Rejoindre les rooms des groupes
        const { all } = require('./db');
        const groups = all('SELECT group_id FROM group_members WHERE user_id = ?', [user.id]);
        groups.forEach(g => socket.join(`group_${g.group_id}`));

        // ── Message de groupe ──
        socket.on('group_message', ({ group_id, content }) => {
            if (!content || !group_id) return;
            const { get, run } = require('./db');
            const isMember = get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [group_id, user.id]);
            if (!isMember) return;

            const result = run('INSERT INTO messages (sender_id, group_id, content) VALUES (?, ?, ?)', [user.id, group_id, content]);

            const message = {
                id: result.lastInsertRowid,
                sender_id: user.id,
                sender_name: user.name,
                sender_role: user.role,
                group_id,
                content,
                created_at: new Date().toISOString()
            };
            io.to(`group_${group_id}`).emit('new_message', message);
        });

        // ── Message privé ──
        socket.on('private_message', ({ receiver_id, content }) => {
            if (!content || !receiver_id) return;
            const { run } = require('./db');
            const result = run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [user.id, receiver_id, content]);

            const message = {
                id: result.lastInsertRowid,
                sender_id: user.id,
                sender_name: user.name,
                sender_role: user.role,
                receiver_id,
                content,
                created_at: new Date().toISOString()
            };
            socket.emit('new_private_message', message);
            const receiverSocketId = connectedUsers.get(parseInt(receiver_id));
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new_private_message', message);
            }
        });

        socket.on('join_group', (group_id) => {
            socket.join(`group_${group_id}`);
        });

        socket.on('disconnect', () => {
            connectedUsers.delete(user.id);
            console.log(`[Socket] ${user.name} déconnecté`);
        });
    });

    server.listen(PORT, () => {
        console.log(`\n🎓 Maths Expert démarré sur http://localhost:${PORT}\n`);
    });
}).catch(err => {
    console.error('Erreur initialisation DB :', err);
    process.exit(1);
});
