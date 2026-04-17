function noop() {}

const db = require('../db');

class MediaRelayServer {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  async init() {
    return undefined;
  }

  getOrCreateRoom(roomId) {
    if (!roomId) {
      throw new Error('Room id is required');
    }

    let room = this.rooms.get(roomId);
    if (room) {
      return room;
    }

    room = {
      roomId,
      socketRoom: `room:${roomId}`,
      publishers: new Map(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  upsertPublisher(room, socket, sourceType = 'camera') {
    const publisher = {
      socketId: socket.id,
      uuid: socket.data.uuid,
      username: socket.data.username,
      sourceType,
      updatedAt: Date.now(),
    };

    room.publishers.set(socket.id, publisher);
    return publisher;
  }

  getRoomForSocket(socket, roomIdOverride) {
    const roomId = roomIdOverride || socket.data.roomId;
    if (!roomId) {
      throw new Error('Socket is not in a room');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Media room does not exist');
    }

    return room;
  }

  stopPublisher(room, socketId, notify = true) {
    const publisher = room.publishers.get(socketId);
    if (!publisher) {
      return;
    }

    room.publishers.delete(socketId);

    // Auto-end focus session when video stream stops
    if (publisher.uuid) {
      this._endFocus(publisher.uuid);
    }

    if (notify) {
      this.io.to(room.socketRoom).emit('media:stream-stopped', {
        socketId: publisher.socketId,
        uuid: publisher.uuid,
        username: publisher.username,
      });
    }
  }

  _startFocus(uuid, roomId) {
    try {
      // Ensure user exists
      const userExists = db.prepare('SELECT 1 FROM users WHERE uuid = ?').get(uuid);
      if (!userExists) return;

      // End any existing active session first
      const active = db.prepare('SELECT * FROM focus_records WHERE user_uuid = ? AND end_time IS NULL').get(uuid);
      if (active) {
        const now = db.beijingNow();
        const startMs = db.beijingToMs(active.start_time);
        const duration = Math.floor((Date.now() - startMs) / 1000);
        db.prepare('UPDATE focus_records SET end_time = ?, duration_seconds = ? WHERE id = ?')
          .run(now, duration, active.id);
      }

      const now = db.beijingNow();
      db.prepare('INSERT INTO focus_records (user_uuid, room_id, start_time) VALUES (?, ?, ?)')
        .run(uuid, roomId || null, now);
      console.log(`Auto-started focus for ${uuid} in room ${roomId}`);
    } catch (err) {
      console.error(`Failed to start focus for ${uuid}:`, err.message);
    }
  }

  _endFocus(uuid) {
    try {
      const active = db.prepare('SELECT * FROM focus_records WHERE user_uuid = ? AND end_time IS NULL').get(uuid);
      if (!active) return;

      const now = db.beijingNow();
      const startMs = db.beijingToMs(active.start_time);
      const duration = Math.floor((Date.now() - startMs) / 1000);
      db.prepare('UPDATE focus_records SET end_time = ?, duration_seconds = ? WHERE id = ?')
        .run(now, duration, active.id);
      console.log(`Auto-ended focus for ${uuid} (${duration}s)`);
    } catch (err) {
      console.error(`Failed to end focus for ${uuid}:`, err.message);
    }
  }

  cleanupPeer(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    this.stopPublisher(room, socket.id, true);
  }

  cleanupEmptyRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const socketRoom = `room:${roomId}`;
    const memberCount = this.io.sockets.adapter.rooms.get(socketRoom)?.size || 0;
    if (memberCount === 0 && room.publishers.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  registerSocket(socket) {
    socket.on('media:publish-state', ({ roomId, active, sourceType } = {}, callback = noop) => {
      try {
        const room = this.getRoomForSocket(socket, roomId);

        if (active) {
          const publisher = this.upsertPublisher(room, socket, sourceType || 'camera');
          // Auto-start focus when video stream begins
          this._startFocus(socket.data.uuid, roomId || socket.data.roomId);
          socket.to(room.socketRoom).emit('media:stream-started', publisher);
        } else {
          this.stopPublisher(room, socket.id, true);
        }

        callback({ ok: true });
      } catch (err) {
        callback({ ok: false, error: err.message });
      }
    });

    socket.on('media:frame', ({ roomId, frame, mimeType, sourceType, width, height, sentAt, uuid, username } = {}, callback = noop) => {
      try {
        if (!frame) {
          throw new Error('Frame is required');
        }

        // Update socket.data if provided (covers reconnect race condition)
        if (uuid && !socket.data.uuid) socket.data.uuid = uuid;
        if (username && !socket.data.username) socket.data.username = username;
        if (roomId && !socket.data.roomId) socket.data.roomId = roomId;

        const room = this.getRoomForSocket(socket, roomId);
        const publisher = this.upsertPublisher(room, socket, sourceType || 'camera');
        publisher.updatedAt = Date.now();
        publisher.width = width;
        publisher.height = height;

        socket.to(room.socketRoom).emit('media:frame', {
          socketId: socket.id,
          uuid: socket.data.uuid,
          username: socket.data.username,
          sourceType: publisher.sourceType,
          mimeType: mimeType || 'image/webp',
          frame,
          width,
          height,
          sentAt: sentAt || Date.now(),
        });

        callback({ ok: true });
      } catch (err) {
        callback({ ok: false, error: err.message });
      }
    });

    socket.on('media:stop-stream', ({ roomId } = {}, callback = noop) => {
      try {
        const room = this.getRoomForSocket(socket, roomId);
        this.stopPublisher(room, socket.id, true);
        callback({ ok: true });
      } catch (err) {
        callback({ ok: false, error: err.message });
      }
    });
  }
}

async function createMediaRelayServer(io) {
  const relay = new MediaRelayServer(io);
  await relay.init();
  return relay;
}

module.exports = { createMediaRelayServer };