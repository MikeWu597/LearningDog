function noop() {}

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

    if (notify) {
      this.io.to(room.socketRoom).emit('media:stream-stopped', {
        socketId: publisher.socketId,
        uuid: publisher.uuid,
        username: publisher.username,
      });
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