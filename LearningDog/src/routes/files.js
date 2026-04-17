const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed file types
const ALLOWED_MIME = new Set([
  'application/pdf',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/x-m4a', 'audio/mp4',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-rar-compressed',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  },
});

// Upload a file
router.post('/upload', upload.single('file'), (req, res) => {
  const { uuid } = req.body;
  if (!uuid || !req.file) {
    return res.status(400).json({ error: '缺少参数' });
  }

  const fileId = uuidv4();
  try {
    db.prepare(
      'INSERT INTO files (id, user_uuid, original_name, stored_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(fileId, uuid, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size);

    res.json({
      ok: true,
      file: {
        id: fileId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List files for a user
router.get('/list/:uuid', (req, res) => {
  const { uuid } = req.params;
  try {
    const files = db.prepare(
      'SELECT id, original_name, mime_type, size, created_at FROM files WHERE user_uuid = ? ORDER BY created_at DESC'
    ).all(uuid);
    res.json(files.map(f => ({
      id: f.id,
      originalName: f.original_name,
      mimeType: f.mime_type,
      size: f.size,
      createdAt: f.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download / preview a file
router.get('/download/:fileId', (req, res) => {
  const { fileId } = req.params;
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) return res.status(404).json({ error: '文件不存在' });

    const filePath = path.join(uploadDir, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });

    // For preview (PDF/audio/images), serve inline; otherwise attachment
    const inline = req.query.inline === '1';
    const disposition = inline ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file info
router.get('/info/:fileId', (req, res) => {
  const { fileId } = req.params;
  try {
    const file = db.prepare('SELECT id, user_uuid, original_name, mime_type, size, created_at FROM files WHERE id = ?').get(fileId);
    if (!file) return res.status(404).json({ error: '文件不存在' });
    res.json({
      id: file.id,
      userUuid: file.user_uuid,
      originalName: file.original_name,
      mimeType: file.mime_type,
      size: file.size,
      createdAt: file.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a file
router.delete('/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { uuid } = req.body;
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) return res.status(404).json({ error: '文件不存在' });
    if (file.user_uuid !== uuid) return res.status(403).json({ error: '无权删除' });

    // Delete from disk
    const filePath = path.join(uploadDir, file.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Delete from DB
    db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multer error handling
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制 (50MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
