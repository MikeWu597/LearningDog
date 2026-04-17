import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getServerUrl } from '../utils/server';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const url = getServerUrl();
    if (!url) return;
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      setConnectionState('connected');
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setConnectionState('reconnecting');
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnectionState('disconnected');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const request = useCallback((event, data = {}) => new Promise((resolve, reject) => {
    if (!socketRef.current) {
      reject(new Error('Socket is not connected'));
      return;
    }

    socketRef.current.emit(event, data, (response) => {
      if (!response) {
        reject(new Error(`${event} failed`));
        return;
      }

      if (response.ok === false) {
        reject(new Error(response.error || `${event} failed`));
        return;
      }

      resolve(response);
    });
  }), []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef, connected, connectionState, emit, on, off, request, connect, disconnect };
}
