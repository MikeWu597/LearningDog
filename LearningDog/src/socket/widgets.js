// roomId -> { uuid -> { emoji: data, clock: data, ... } }
const widgetStates = new Map();

function setupWidgets(socket) {
  socket.on('widget-update', (data) => {
    const { roomId, type, data: widgetData } = data;
    if (!roomId) return;

    // Store widget state (merge by type so emoji and clock coexist)
    if (!widgetStates.has(roomId)) {
      widgetStates.set(roomId, new Map());
    }
    const roomWidgets = widgetStates.get(roomId);
    const existing = roomWidgets.get(socket.data.uuid) || {};

    // For clock widgets, record server timestamp so we can compute real-time value later
    const stored = type === 'clock'
      ? { ...widgetData, savedAt: Date.now() }
      : widgetData;
    roomWidgets.set(socket.data.uuid, { ...existing, [type]: stored });

    socket.to(`room:${roomId}`).emit('widget-update', {
      from: socket.id,
      uuid: socket.data.uuid,
      type,
      data: widgetData,
    });
  });
}

// Compute real-time clock seconds based on elapsed time since last save
function resolveClockState(clockData) {
  if (!clockData || !clockData.running || !clockData.savedAt) return clockData;
  const elapsed = Math.floor((Date.now() - clockData.savedAt) / 1000);
  let seconds = clockData.mode === 'down'
    ? clockData.seconds - elapsed
    : clockData.seconds + elapsed;
  if (clockData.mode === 'down' && seconds <= 0) {
    return { ...clockData, running: false, seconds: 0, savedAt: undefined };
  }
  return { ...clockData, seconds, savedAt: undefined };
}

function getWidgetStates(roomId) {
  const roomWidgets = widgetStates.get(roomId);
  if (!roomWidgets) return {};
  const result = {};
  for (const [uuid, state] of roomWidgets.entries()) {
    const resolved = { ...state };
    if (resolved.clock) resolved.clock = resolveClockState(resolved.clock);
    result[uuid] = resolved;
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
