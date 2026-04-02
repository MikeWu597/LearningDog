const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = Router();

// POST /api/rooms/create
router.post('/create', (req, res) => {
  try {
    const { name, maxUsers } = req.body;
    if (!name || !maxUsers) {
      return res.status(400).json({ error: 'name and maxUsers are required' });
    }
    if (![2, 4, 9].includes(maxUsers)) {
      return res.status(400).json({ error: 'maxUsers must be 2, 4, or 9' });
    }

    const roomId = uuidv4();
    db.prepare('INSERT INTO rooms (id, name, max_users) VALUES (?, ?, ?)')
      .run(roomId, name, maxUsers);

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms
router.get('/', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms').all();
    const result = rooms.map(room => {
      const memberCount = db.prepare('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?')
        .get(room.id).count;
      return { ...room, currentUsers: memberCount };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/:roomId
router.get('/:roomId', (req, res) => {
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const members = db.prepare(`
      SELECT rm.user_uuid, u.username, rm.joined_at
      FROM room_members rm
      JOIN users u ON u.uuid = rm.user_uuid
      WHERE rm.room_id = ?
    `).all(req.params.roomId);

    res.json({ ...room, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:roomId/join
router.post('/:roomId/join', (req, res) => {
  try {
    const { uuid } = req.body;
    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required' });
    }

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const memberCount = db.prepare('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?')
      .get(req.params.roomId).count;
    if (memberCount >= room.max_users) {
      return res.status(400).json({ error: 'Room is full' });
    }

    const existing = db.prepare('SELECT * FROM room_members WHERE room_id = ? AND user_uuid = ?')
      .get(req.params.roomId, uuid);
    if (existing) {
      return res.json({ message: 'Already in room' });
    }

    // Leave any other room first
    db.prepare('DELETE FROM room_members WHERE user_uuid = ?').run(uuid);

    db.prepare('INSERT INTO room_members (room_id, user_uuid) VALUES (?, ?)')
      .run(req.params.roomId, uuid);

    res.json({ message: 'Joined room successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:roomId/leave
router.post('/:roomId/leave', (req, res) => {
  try {
    const { uuid } = req.body;
    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required' });
    }

    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_uuid = ?')
      .run(req.params.roomId, uuid);

    res.json({ message: 'Left room successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
