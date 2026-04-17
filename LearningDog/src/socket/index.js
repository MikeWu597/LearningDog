const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { setupWidgets, getWidgetStates, getUserWidgetState, removeUserWidgets, cleanupRoomWidgets, resolveClockState } = require('./widgets');

const RECONNECT_TIMEOUT = 12 * 60 * 60 * 1000; // 12 hours
// uuid -> { timer, roomId, username, socketId }
const disconnectedUsers = new Map();

// roomId -> { uuid -> { fileId, originalName, mimeType } }
const sharedFiles = new Map();

function setupSocket(io, mediaRelay) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, uuid, username }, callback = () => {}) => {
      if (!roomId || !uuid || !username) {
        callback({ ok: false, error: 'roomId, uuid and username are required' });
        return;
      }

      try {
        await mediaRelay.getOrCreateRoom(roomId);
      } catch (err) {
        callback({ ok: false, error: err.message });
        return;
      }

      // Check if user is reconnecting within grace period
      const pending = disconnectedUsers.get(uuid);
      if (pending) {
        clearTimeout(pending.timer);
        disconnectedUsers.delete(uuid);
        console.log(`User ${uuid} reconnected within grace period`);

        if (pending.roomId === roomId) {
          // Same room: re-broadcast preserved widgets to other users
          const userWidgets = getUserWidgetState(roomId, uuid);
          if (userWidgets) {
            const socketRoom = `room:${roomId}`;
            for (const [type, data] of Object.entries(userWidgets)) {
              const resolved = type === 'clock' ? resolveClockState(data) : data;
              socket.to(socketRoom).emit('widget-update', {
                from: socket.id,
                uuid,
                type,
                data: resolved,
              });
            }
          }
        } else {
          // Different room: clean up old widgets
          removeUserWidgets(pending.roomId, uuid);
        }
      }

      // Store user info on socket
      socket.data.roomId = roomId;
      socket.data.uuid = uuid;
      socket.data.username = username;

      const socketRoom = `room:${roomId}`;
      socket.join(socketRoom);

      // Broadcast to others in the room
      socket.to(socketRoom).emit('user-joined', {
        socketId: socket.id,
        uuid,
        username,
      });

      // Send current room users to the joining user
      const sockets = io.sockets.adapter.rooms.get(socketRoom);
      const users = [];
      if (sockets) {
        for (const sid of sockets) {
          const s = io.sockets.sockets.get(sid);
          if (s && s.data.uuid) {
            users.push({
              socketId: s.id,
              uuid: s.data.uuid,
              username: s.data.username,
            });
          }
        }
      }
      socket.emit('room-users', users);

      // Send current widget states to the joining user
      const widgetStates = getWidgetStates(roomId);
      if (Object.keys(widgetStates).length > 0) {
        socket.emit('widget-states', widgetStates);
      }

      // Send current shared files state
      const roomFiles = sharedFiles.get(roomId);
      if (roomFiles && roomFiles.size > 0) {
        const filesState = {};
        for (const [uuid, fdata] of roomFiles.entries()) {
          filesState[uuid] = fdata;
        }
        socket.emit('shared-files-state', filesState);
      }

      // Send recent messages for this room (last 50)
      try {
        const messages = db.prepare(
          'SELECT id, room_id, sender_uuid, sender_name, content, created_at FROM room_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 50'
        ).all(roomId).reverse().map(m => ({
          id: m.id, roomId: m.room_id, senderUuid: m.sender_uuid,
          senderName: m.sender_name, content: m.content, createdAt: m.created_at,
        }));
        if (messages.length > 0) {
          // Also get acks for these messages
          const msgIds = messages.map(m => m.id);
          const placeholders = msgIds.map(() => '?').join(',');
          const acks = db.prepare(
            `SELECT message_id, user_uuid, username, acked_at FROM message_acks WHERE message_id IN (${placeholders})`
          ).all(...msgIds);
          const ackMap = {};
          for (const ack of acks) {
            if (!ackMap[ack.message_id]) ackMap[ack.message_id] = [];
            ackMap[ack.message_id].push({
              userUuid: ack.user_uuid,
              username: ack.username,
              ackedAt: ack.acked_at,
            });
          }
          socket.emit('room-messages-history', { messages, acks: ackMap });
        }
      } catch (_) {}

      callback({ ok: true, users });
    });

    socket.on('leave-room', () => {
      handleLeaveRoom(socket, io, mediaRelay, true);
    });

    // --- File sharing ---
    socket.on('file-share', ({ roomId, fileId, originalName, mimeType }) => {
      if (!roomId || !fileId || !socket.data.uuid) return;
      if (!sharedFiles.has(roomId)) sharedFiles.set(roomId, new Map());
      sharedFiles.get(roomId).set(socket.data.uuid, { fileId, originalName, mimeType });
      socket.to(`room:${roomId}`).emit('file-share', {
        uuid: socket.data.uuid,
        fileId,
        originalName,
        mimeType,
      });
    });

    socket.on('file-unshare', ({ roomId }) => {
      if (!roomId || !socket.data.uuid) return;
      const roomFiles = sharedFiles.get(roomId);
      if (roomFiles) {
        roomFiles.delete(socket.data.uuid);
        if (roomFiles.size === 0) sharedFiles.delete(roomId);
      }
      socket.to(`room:${roomId}`).emit('file-unshare', { uuid: socket.data.uuid });
    });

    // --- Room messaging ---
    socket.on('room-message', ({ roomId, content }, callback = () => {}) => {
      if (!roomId || !content || !socket.data.uuid) return;
      const msgId = uuidv4();
      const senderUuid = socket.data.uuid;
      const senderName = socket.data.username;
      try {
        db.prepare(
          'INSERT INTO room_messages (id, room_id, sender_uuid, sender_name, content) VALUES (?, ?, ?, ?, ?)'
        ).run(msgId, roomId, senderUuid, senderName, content);
      } catch (_) {}

      const msg = { id: msgId, roomId, senderUuid, senderName, content, createdAt: db.beijingNow() };
      // Send to all in room including sender
      io.to(`room:${roomId}`).emit('room-message', msg);
      callback({ ok: true, message: msg });
    });

    socket.on('message-ack', ({ messageId, roomId }) => {
      if (!messageId || !socket.data.uuid) return;
      const userUuid = socket.data.uuid;
      const username = socket.data.username;
      try {
        db.prepare(
          'INSERT OR IGNORE INTO message_acks (message_id, user_uuid, username) VALUES (?, ?, ?)'
        ).run(messageId, userUuid, username);
      } catch (_) {}

      // Broadcast ack to all in room
      io.to(`room:${roomId}`).emit('message-ack', {
        messageId,
        userUuid,
        username,
        ackedAt: db.beijingNow(),
      });
    });

    mediaRelay.registerSocket(socket);
    setupWidgets(socket);

    // Heartbeat for client-side RTT measurement
    socket.on('heartbeat', (data, callback = () => {}) => {
      callback({ ts: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      handleLeaveRoom(socket, io, mediaRelay, false);
    });
  });
}

function handleLeaveRoom(socket, io, mediaRelay, intentional) {
  const { roomId, uuid, username } = socket.data;
  if (!roomId) return;

  const socketRoom = `room:${roomId}`;

  mediaRelay.cleanupPeer(socket);
  socket.leave(socketRoom);
  mediaRelay.cleanupEmptyRoom(roomId);

  // Broadcast to others
  socket.to(socketRoom).emit('user-left', {
    socketId: socket.id,
    uuid,
    username,
  });

  // Remove from room_members in DB
  if (uuid) {
    try {
      db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_uuid = ?').run(roomId, uuid);
    } catch (_) {}

    // Clean up shared files for this user
    const roomFiles = sharedFiles.get(roomId);
    if (roomFiles) {
      roomFiles.delete(uuid);
      if (roomFiles.size === 0) sharedFiles.delete(roomId);
    }
    socket.to(socketRoom).emit('file-unshare', { uuid });

    if (!intentional) {
      // Unexpected disconnect: start grace period for widget preservation
      const existing = disconnectedUsers.get(uuid);
      if (existing) {
        clearTimeout(existing.timer);
      }

      const timer = setTimeout(() => {
        disconnectedUsers.delete(uuid);
        // Clean up widgets
        removeUserWidgets(roomId, uuid);
        const memberCount = io.sockets.adapter.rooms.get(socketRoom)?.size || 0;
        if (memberCount === 0) {
          cleanupRoomWidgets(roomId);
        }
      }, RECONNECT_TIMEOUT);

      disconnectedUsers.set(uuid, {
        timer,
        roomId,
        username,
        socketId: socket.id,
      });
    } else {
      // Intentional leave: clean up immediately
      removeUserWidgets(roomId, uuid);
      const memberCount = io.sockets.adapter.rooms.get(socketRoom)?.size || 0;
      if (memberCount === 0) {
        cleanupRoomWidgets(roomId);
      }
    }
  }

  // Clear socket data
  socket.data.roomId = null;
}

module.exports = { setupSocket };
