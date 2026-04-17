const db = require('../db');
const { setupWidgets, getWidgetStates, getUserWidgetState, removeUserWidgets, cleanupRoomWidgets, resolveClockState } = require('./widgets');

const RECONNECT_TIMEOUT = 12 * 60 * 60 * 1000; // 12 hours
// uuid -> { timer, roomId, username, socketId }
const disconnectedUsers = new Map();

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

      callback({ ok: true, users });
    });

    socket.on('leave-room', () => {
      handleLeaveRoom(socket, io, mediaRelay, true);
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
