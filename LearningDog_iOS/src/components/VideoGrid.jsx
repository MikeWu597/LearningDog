import React from 'react';
import VideoCell from './VideoCell';

export default function VideoGrid({
  gridSize,
  localVideoRef,
  localStream,
  localUser,
  localEmoji,
  localTimer,
  remoteStreams,
  widgets,
  roomUsers = [],
}) {
  const cols = gridSize === 2 ? 2 : gridSize === 4 ? 2 : 3;
  const rows = gridSize === 2 ? 1 : gridSize === 4 ? 2 : 3;

  const cells = [];

  cells.push(
    <VideoCell
      key="local"
      videoRef={localVideoRef}
      stream={localStream}
      username={localUser?.username || '我'}
      isLocal
      emoji={localEmoji}
      timer={localTimer}
      networkStatus="good"
    />
  );

  roomUsers.forEach(roomUser => {
    const remote = remoteStreams[roomUser.socketId];
    const widget = widgets[roomUser.uuid];
    cells.push(
      <VideoCell
        key={roomUser.socketId}
        stream={remote?.stream}
        frameUrl={remote?.frameUrl}
        username={roomUser.username || '用户'}
        emoji={widget?.emoji?.emoji || ''}
        timer={widget?.clock || null}
        networkStatus={remote ? 'good' : 'none'}
      />
    );
  });

  while (cells.length < gridSize) {
    cells.push(
      <div
        key={`empty-${cells.length}`}
        style={{
          background: '#2a2a3e',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: 12,
        }}
      >
        等待加入...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 4,
        height: '100%',
        width: '100%',
      }}
    >
      {cells.slice(0, gridSize)}
    </div>
  );
}
