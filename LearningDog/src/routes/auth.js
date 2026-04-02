const { Router } = require('express');
const db = require('../db');

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { uuid, username } = req.body;
    if (!uuid || !username) {
      return res.status(400).json({ error: 'uuid and username are required' });
    }

    const existing = db.prepare('SELECT * FROM users WHERE uuid = ?').get(uuid);

    if (existing) {
      db.prepare('UPDATE users SET username = ?, updated_at = datetime(\'now\') WHERE uuid = ?')
        .run(username, uuid);
    } else {
      db.prepare('INSERT INTO users (uuid, username) VALUES (?, ?)').run(uuid, username);
    }

    const user = db.prepare('SELECT * FROM users WHERE uuid = ?').get(uuid);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/user/:uuid
router.get('/user/:uuid', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE uuid = ?').get(req.params.uuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
