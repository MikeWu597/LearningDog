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

  useEffect(() => {
    const el = videoEl.current;
    if (el && stream) {
      el.srcObject = stream;
    }
  }, [stream, videoEl]);

  useEffect(() => {
    if (!timer || !timer.running) {
      if (timer) setTimerDisplay(timer.seconds || 0);
      return;
    }

    setTimerDisplay(timer.seconds || 0);
    const interval = setInterval(() => {
      setTimerDisplay(prev => {
        if (timer.mode === 'down') return prev > 0 ? prev - 1 : 0;
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer?.running, timer?.mode, timer?.seconds]);

  const statusColor = networkStatus === 'good' ? '#52c41a' : networkStatus === 'none' ? '#aaa' : networkStatus === 'medium' ? '#faad14' : '#ff4d4f';

  return (
    <div
      style={{
        position: 'relative',
        background: '#1a1a2e',
        borderRadius: 6,
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
        <div style={{ color: '#666', fontSize: 32 }}>
          {emoji || '📷'}
        </div>
      )}

      {/* Username - bottom left */}
      <div style={{
        position: 'absolute', bottom: 4, left: 4,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        padding: '1px 6px', borderRadius: 3, fontSize: 10,
      }}>
        {isLocal ? `${username} (我)` : username}
      </div>

      {/* Network status - bottom right */}
      <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
      </div>

      {/* Status overlay - center */}
      {emoji && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.45)', color: '#fff',
          padding: '4px 10px', borderRadius: 6,
          fontSize: 14, whiteSpace: 'nowrap',
          maxWidth: '80%', textAlign: 'center',
        }}>
          {emoji}
        </div>
      )}

      {/* Timer - top left */}
      {timer && (timer.running || timer.seconds > 0) && (
        <div style={{
          position: 'absolute', top: 4, left: 4,
          background: timer.running ? 'rgba(82,196,26,0.8)' : 'rgba(0,0,0,0.6)',
          color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'monospace',
        }}>
          {timer.mode === 'down' ? '⏬' : '⏫'} {formatTime(timerDisplay)}
        </div>
      )}
    </div>
  );
}
