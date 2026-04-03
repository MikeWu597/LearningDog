const { Router } = require('express');
const db = require('../db');

const router = Router();

// POST /api/records/start
router.post('/start', (req, res) => {
  try {
    const { uuid, roomId } = req.body;
    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required' });
    }

    // Stop any existing active session first
    const active = db.prepare('SELECT * FROM focus_records WHERE user_uuid = ? AND end_time IS NULL').get(uuid);
    if (active) {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const startMs = new Date(active.start_time + 'Z').getTime();
      const duration = Math.floor((Date.now() - startMs) / 1000);
      db.prepare('UPDATE focus_records SET end_time = ?, duration_seconds = ? WHERE id = ?')
        .run(now, duration, active.id);
    }

    const result = db.prepare('INSERT INTO focus_records (user_uuid, room_id) VALUES (?, ?)')
      .run(uuid, roomId || null);

    const record = db.prepare('SELECT * FROM focus_records WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/records/stop
router.post('/stop', (req, res) => {
  try {
    const { uuid } = req.body;
    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required' });
    }

    const active = db.prepare('SELECT * FROM focus_records WHERE user_uuid = ? AND end_time IS NULL').get(uuid);
    if (!active) {
      return res.status(404).json({ error: 'No active focus session' });
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const startMs = new Date(active.start_time + 'Z').getTime();
    const duration = Math.floor((Date.now() - startMs) / 1000);

    db.prepare('UPDATE focus_records SET end_time = ?, duration_seconds = ? WHERE id = ?')
      .run(now, duration, active.id);

    const record = db.prepare('SELECT * FROM focus_records WHERE id = ?').get(active.id);
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/records/:uuid
router.get('/:uuid', (req, res) => {
  try {
    const records = db.prepare('SELECT * FROM focus_records WHERE user_uuid = ? ORDER BY start_time DESC')
      .all(req.params.uuid);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/records/:uuid/daily
router.get('/:uuid/daily', (req, res) => {
  try {
    const daily = db.prepare(`
      SELECT date(start_time) as date, SUM(duration_seconds) as total_seconds
      FROM focus_records
      WHERE user_uuid = ? AND duration_seconds IS NOT NULL
      GROUP BY date(start_time)
      ORDER BY date DESC
    `).all(req.params.uuid);
    res.json(daily);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/records/:uuid/stats
router.get('/:uuid/stats', (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds
      FROM focus_records
      WHERE user_uuid = ? AND duration_seconds IS NOT NULL
    `).get(req.params.uuid);

    const dayCount = db.prepare(`
      SELECT COUNT(DISTINCT date(start_time)) as days
      FROM focus_records
      WHERE user_uuid = ? AND duration_seconds IS NOT NULL
    `).get(req.params.uuid);

    const sessionCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM focus_records
      WHERE user_uuid = ? AND duration_seconds IS NOT NULL
    `).get(req.params.uuid);

    const avgDaily = dayCount.days > 0 ? Math.round(total.total_seconds / dayCount.days) : 0;

    res.json({
      totalSeconds: total.total_seconds,
      totalDays: dayCount.days,
      totalSessions: sessionCount.count,
      avgDailySeconds: avgDaily,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
