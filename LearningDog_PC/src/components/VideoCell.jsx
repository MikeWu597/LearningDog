import React, { useRef, useEffect, useState } from 'react';
import { getFileDownloadUrl } from '../utils/api';

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
  sharedFile,
}) {
  const internalVideoRef = useRef(null);
  const videoEl = externalVideoRef || internalVideoRef;
  const [timerDisplay, setTimerDisplay] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

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

  const statusColor = networkStatus === 'good' ? '#52c41a' : networkStatus === 'none' ? '#aaa' : networkStatus === 'medium' ? '#faad14' : '#ff4d4f';

  return (
    <div
      style={{
        position: 'relative',
        background: '#c7ddf5',
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
        <div style={{ color: '#8ba4c4', fontSize: 48 }}>
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

      {/* Status overlay - center */}
      {emoji && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: 10,
            fontSize: 24,
            whiteSpace: 'nowrap',
            maxWidth: '80%',
            textAlign: 'center',
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

      {/* Shared file icon - top right */}
      {sharedFile && (
        <div
          onClick={() => setShowPreview(true)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(24, 144, 255, 0.85)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title={sharedFile.originalName || '查看共享文件'}
        >
          📄
        </div>
      )}

      {/* File preview overlay */}
      {showPreview && sharedFile && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', color: '#fff', fontSize: 12 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sharedFile.originalName || '文件'}</span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <a href={getFileDownloadUrl(sharedFile.fileId)} download style={{ color: '#69b1ff' }}>💾</a>
              <span onClick={() => setShowPreview(false)} style={{ cursor: 'pointer' }}>✕</span>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {sharedFile.mimeType === 'application/pdf' ? (
              <iframe src={getFileDownloadUrl(sharedFile.fileId, true)} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF" />
            ) : sharedFile.mimeType?.startsWith('audio/') ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <audio controls src={getFileDownloadUrl(sharedFile.fileId, true)} style={{ width: '80%' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
                <a href={getFileDownloadUrl(sharedFile.fileId)} download style={{ color: '#69b1ff', fontSize: 14 }}>📥 下载文件</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
