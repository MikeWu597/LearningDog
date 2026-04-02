import React, { useRef, useEffect, useState } from 'react';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoCell({
  stream,
  frameUrl,
  videoRef: externalVideoRef,
  username,
  isLocal,
  emoji,
  timer,
  networkStatus = 'good',
}) {
  const internalVideoRef = useRef(null);
  const videoEl = externalVideoRef || internalVideoRef;
  const [timerDisplay, setTimerDisplay] = useState(0);

  // Set stream on video element
  useEffect(() => {
    const el = videoEl.current;
    if (el && stream) {
      el.srcObject = stream;
    }
  }, [stream, videoEl]);

  // Timer logic (client-side rendering of timer metadata)
  useEffect(() => {
    if (!timer || !timer.running) {
      if (timer) setTimerDisplay(timer.seconds || 0);
      return;
    }

    setTimerDisplay(timer.seconds || 0);
    const interval = setInterval(() => {
      setTimerDisplay(prev => {
        if (timer.mode === 'down') {
          return prev > 0 ? prev - 1 : 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer?.running, timer?.mode, timer?.seconds]);

  const statusColor = networkStatus === 'good' ? '#52c41a' : networkStatus === 'medium' ? '#faad14' : '#ff4d4f';

  return (
    <div
      style={{
        position: 'relative',
        background: '#1a1a2e',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {stream ? (
        <video
          ref={videoEl}
          autoPlay
          playsInline
          muted={isLocal}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : frameUrl ? (
        <img
          src={frameUrl}
          alt={username}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ color: '#666', fontSize: 48 }}>
          {emoji || '📷'}
        </div>
      )}

      {/* Username - bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {isLocal ? `${username} (我)` : username}
      </div>

      {/* Network status - bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
          }}
        />
      </div>

      {/* Emoji overlay - top right */}
      {emoji && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 32,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {emoji}
        </div>
      )}

      {/* Timer overlay - top left */}
      {timer && (timer.running || timer.seconds > 0) && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: timer.running ? 'rgba(82, 196, 26, 0.8)' : 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 14,
            fontFamily: 'monospace',
          }}
        >
          {timer.mode === 'down' ? '⏬' : '⏫'} {formatTime(timerDisplay)}
        </div>
      )}
    </div>
  );
}
