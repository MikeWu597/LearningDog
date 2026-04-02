function setupWidgets(socket) {
  socket.on('widget-update', (data) => {
    // data: { roomId, type: 'emoji'|'clock', data: {...} }
    const { roomId, ...widgetData } = data;
    if (!roomId) return;
    socket.to(`room:${roomId}`).emit('widget-update', {
      from: socket.id,
      uuid: socket.data.uuid,
      ...widgetData,
    });
  });
}

module.exports = { setupWidgets };
