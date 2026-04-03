import { useRef, useState, useCallback, useEffect } from 'react';

const FRAME_INTERVAL_MS = 180;
const FRAME_MIME_TYPE = 'image/webp';
const FRAME_QUALITY = 0.55;

function frameToBlob(frame, mimeType) {
  if (frame instanceof Blob) {
    return frame;
  }

  if (frame instanceof ArrayBuffer) {
    return new Blob([frame], { type: mimeType });
  }

  if (ArrayBuffer.isView(frame)) {
    return new Blob([frame.buffer], { type: mimeType });
  }

  return new Blob([frame], { type: mimeType });
}

const STALE_TIMEOUT_MS = 2000;

export function useWebRTC({ socket, localStream, roomId, sourceType = 'camera', uuid, username }) {
  const publisherRef = useRef(null);
  const frameUrlsRef = useRef(new Map());
  const lastFrameTimeRef = useRef(new Map());
  const sourceTypeRef = useRef(sourceType);
  const [remoteStreams, setRemoteStreams] = useState({});

  useEffect(() => {
    sourceTypeRef.current = sourceType;
  }, [sourceType]);

  const removeRemote = useCallback((socketId) => {
    const existingUrl = frameUrlsRef.current.get(socketId);
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      frameUrlsRef.current.delete(socketId);
    }

    lastFrameTimeRef.current.delete(socketId);

    setRemoteStreams(prev => {
      if (!prev[socketId]) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  const stopPublishing = useCallback((notify = true) => {
    const publisher = publisherRef.current;
    if (!publisher) {
      return;
    }

    clearInterval(publisher.intervalId);
    publisher.video.pause();
    publisher.video.srcObject = null;
    publisher.canvas.width = 0;
    publisher.canvas.height = 0;
    publisherRef.current = null;

    if (notify && socket.current?.connected && roomId) {
      socket.current.emit('media:stop-stream', { roomId });
    }
  }, [roomId, socket]);

  const startPublishing = useCallback((stream) => {
    if (!socket.current?.connected || !roomId || !stream) {
      return;
    }

    stopPublishing(false);

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};
    const canvas = document.createElement('canvas');
    canvas.width = settings.width || 640;
    canvas.height = settings.height || 360;
    const ctx = canvas.getContext('2d', { alpha: false });

    let busy = false;
    const publishFrame = () => {
      if (busy || video.readyState < 2 || !socket.current?.connected) {
        return;
      }

      busy = true;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        try {
          if (!blob || !socket.current?.connected) {
            return;
          }

          const frame = await blob.arrayBuffer();
          socket.current.emit('media:frame', {
            roomId,
            frame,
            mimeType: FRAME_MIME_TYPE,
            sourceType: sourceTypeRef.current,
            width: canvas.width,
            height: canvas.height,
            sentAt: Date.now(),
            uuid,
            username,
          });
        } finally {
          busy = false;
        }
      }, FRAME_MIME_TYPE, FRAME_QUALITY);
    };

    const intervalId = window.setInterval(publishFrame, FRAME_INTERVAL_MS);
    socket.current.emit('media:publish-state', {
      roomId,
      active: true,
      sourceType: sourceTypeRef.current,
    });

    video.play().catch(() => {});
    publisherRef.current = { video, canvas, intervalId };
  }, [roomId, socket, stopPublishing]);

  useEffect(() => {
    if (!socket.current) return undefined;
    const s = socket.current;

    const handleFrame = ({ socketId, uuid, username, sourceType: remoteSourceType, mimeType, frame }) => {
      lastFrameTimeRef.current.set(socketId, Date.now());
      const frameUrl = URL.createObjectURL(frameToBlob(frame, mimeType || FRAME_MIME_TYPE));
      const existingUrl = frameUrlsRef.current.get(socketId);
      if (existingUrl) {
        URL.revokeObjectURL(existingUrl);
      }
      frameUrlsRef.current.set(socketId, frameUrl);

      setRemoteStreams(prev => ({
        ...prev,
        [socketId]: {
          uuid,
          username,
          sourceType: remoteSourceType,
          frameUrl,
        },
      }));
    };

    const handleUserLeft = ({ socketId }) => {
      removeRemote(socketId);
    };

    const handleStreamStopped = ({ socketId }) => {
      removeRemote(socketId);
    };

    const handleReconnect = () => {
      if (publisherRef.current && roomId) {
        s.emit('media:publish-state', {
          roomId,
          active: true,
          sourceType: sourceTypeRef.current,
        });
      }
    };

    s.on('media:frame', handleFrame);
    s.on('user-left', handleUserLeft);
    s.on('media:stream-stopped', handleStreamStopped);
    s.on('connect', handleReconnect);

    const sweepId = setInterval(() => {
      const now = Date.now();
      for (const [sid, ts] of lastFrameTimeRef.current.entries()) {
        if (now - ts > STALE_TIMEOUT_MS) {
          removeRemote(sid);
        }
      }
    }, 1000);

    return () => {
      clearInterval(sweepId);
      s.off('media:frame', handleFrame);
      s.off('user-left', handleUserLeft);
      s.off('media:stream-stopped', handleStreamStopped);
      s.off('connect', handleReconnect);
    };
  }, [removeRemote, roomId, socket]);

  useEffect(() => {
    if (!localStream) {
      stopPublishing(true);
      return undefined;
    }

    startPublishing(localStream);
    return () => stopPublishing(true);
  }, [localStream, sourceType, startPublishing, stopPublishing]);

  useEffect(() => () => {
    stopPublishing(false);
    for (const frameUrl of frameUrlsRef.current.values()) {
      URL.revokeObjectURL(frameUrl);
    }
    frameUrlsRef.current.clear();
  }, [stopPublishing]);

  const closeAll = useCallback(() => {
    stopPublishing(true);
    for (const socketId of Array.from(frameUrlsRef.current.keys())) {
      removeRemote(socketId);
    }
  }, [removeRemote, stopPublishing]);

  return { remoteStreams, closeAll };
}
