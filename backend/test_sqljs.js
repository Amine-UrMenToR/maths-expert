const { initDb } = require('./db');

initDb().then(db => {
    // Let's create an empty DB by taking the original
    try {
        const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
        const res = stmt.get('test@test.com');
        console.log('Result of get(string):', res);
        
        const res2 = stmt.get(['test@test.com']);
        console.log('Result of get([string]):', res2);

        stmt.free();
    } catch (e) {
        console.error(e);
    }
});
