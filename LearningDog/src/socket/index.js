const db = require('../db');
const { setupSignaling } = require('./signaling');
const { setupWidgets } = require('./widgets');

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, uuid, username }) => {
      if (!roomId || !uuid || !username) return;

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
    });

    socket.on('leave-room', () => {
      handleLeaveRoom(socket, io);
    });

    setupSignaling(socket);
    setupWidgets(socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      handleLeaveRoom(socket, io);
    });
  });
}

function handleLeaveRoom(socket, io) {
  const { roomId, uuid, username } = socket.data;
  if (!roomId) return;

  const socketRoom = `room:${roomId}`;
  socket.leave(socketRoom);

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

    // Stop any active focus session
    try {
      const active = db.prepare('SELECT * FROM focus_records WHERE user_uuid = ? AND end_time IS NULL').get(uuid);
      if (active) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const startMs = new Date(active.start_time).getTime();
        const duration = Math.floor((Date.now() - startMs) / 1000);
        db.prepare('UPDATE focus_records SET end_time = ?, duration_seconds = ? WHERE id = ?')
          .run(now, duration, active.id);
      }
    } catch (_) {}
  }

  // Clear socket data
  socket.data.roomId = null;
}

module.exports = { setupSocket };
