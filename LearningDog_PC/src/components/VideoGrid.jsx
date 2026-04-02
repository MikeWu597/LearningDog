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
}) {
  const cols = gridSize === 2 ? 2 : gridSize === 4 ? 2 : 3;
  const rows = gridSize === 2 ? 1 : gridSize === 4 ? 2 : 3;

  const cells = [];

  // Local user cell
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

  // Remote user cells
  Object.entries(remoteStreams).forEach(([socketId, { stream, uuid, username }]) => {
    const widget = widgets[uuid];
    cells.push(
      <VideoCell
        key={socketId}
        stream={stream}
        username={username || '用户'}
        emoji={widget?.type === 'emoji' ? widget.data?.emoji : ''}
        timer={widget?.type === 'clock' ? widget.data : null}
        networkStatus="good"
      />
    );
  });

  // Fill empty cells
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
          fontSize: 14,
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
        gap: 8,
        height: '100%',
        width: '100%',
      }}
    >
      {cells.slice(0, gridSize)}
    </div>
  );
}
