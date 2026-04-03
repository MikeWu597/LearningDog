// roomId -> { uuid -> { type, data } }
const widgetStates = new Map();

function setupWidgets(socket) {
  socket.on('widget-update', (data) => {
    const { roomId, type, data: widgetData } = data;
    if (!roomId) return;

    // Store widget state
    if (!widgetStates.has(roomId)) {
      widgetStates.set(roomId, new Map());
    }
    widgetStates.get(roomId).set(socket.data.uuid, { type, data: widgetData });

    socket.to(`room:${roomId}`).emit('widget-update', {
      from: socket.id,
      uuid: socket.data.uuid,
      type,
      data: widgetData,
    });
  });
}

function getWidgetStates(roomId) {
  const roomWidgets = widgetStates.get(roomId);
  if (!roomWidgets) return {};
  const result = {};
  for (const [uuid, state] of roomWidgets.entries()) {
    result[uuid] = state;
  }
  return result;
}

function removeUserWidgets(roomId, uuid) {
  const roomWidgets = widgetStates.get(roomId);
  if (roomWidgets) {
    roomWidgets.delete(uuid);
    if (roomWidgets.size === 0) {
      widgetStates.delete(roomId);
    }
  }
}

function cleanupRoomWidgets(roomId) {
  widgetStates.delete(roomId);
}

module.exports = { setupWidgets, getWidgetStates, removeUserWidgets, cleanupRoomWidgets };
