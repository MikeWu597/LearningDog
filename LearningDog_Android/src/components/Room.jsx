import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, Button, Toast, Space } from 'antd-mobile';
import { useApp } from '../App';
import { apiLeaveRoom } from '../utils/api';
import { useWebRTC } from '../hooks/useWebRTC';
import { createCompressedStream, createBlurredStream } from '../utils/mediaProcessing';
import { ensureCameraPermission } from '../utils/permissions';
import { getKeepAwake, requestKeepAwake, releaseKeepAwake } from '../utils/keepAwake';
import VideoGrid from './VideoGrid';
import Widgets from './Widgets';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, socket, emit, on, request, connectionState } = useApp();

  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [blurOn, setBlurOn] = useState(true);
  const [widgets, setWidgets] = useState({});
  const [myEmoji, setMyEmoji] = useState('');
  const [myTimer, setMyTimer] = useState({ mode: 'up', running: false, seconds: 0 });
  const [roomUsers, setRoomUsers] = useState([]);

  const localVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const facingModeRef = useRef('user');
  const blurOnRef = useRef(true);
  const myEmojiRef = useRef('');
  const myTimerRef = useRef({ mode: 'up', running: false, seconds: 0 });

  const { remoteStreams, closeAll } = useWebRTC({
    socket,
    localStream,
    roomId,
    sourceType: 'camera',
    uuid: user?.uuid,
    username: user?.username,
  });

  // Keep screen awake if enabled
  useEffect(() => {
    if (getKeepAwake()) requestKeepAwake();
    return () => releaseKeepAwake();
  }, []);

  // Keep refs in sync for reconnect widget sync
  useEffect(() => { myEmojiRef.current = myEmoji; }, [myEmoji]);
  useEffect(() => { myTimerRef.current = myTimer; }, [myTimer]);

  // Join room on mount and on reconnect
  useEffect(() => {
    if (!socket.current || !user) return;

    let isFirstJoin = true;
    const joinRoom = async () => {
      try {
        await request('join-room', { roomId, uuid: user.uuid, username: user.username });
        if (!isFirstJoin) {
          if (myEmojiRef.current) {
            emit('widget-update', { roomId, type: 'emoji', data: { emoji: myEmojiRef.current } });
          }
          if (myTimerRef.current.running || myTimerRef.current.seconds > 0) {
            emit('widget-update', { roomId, type: 'clock', data: myTimerRef.current });
          }
        }
        isFirstJoin = false;
      } catch (err) {
        Toast.show({ content: err.message || '加入房间失败' });
      }
    };

    socket.current.on('connect', joinRoom);
    if (socket.current.connected) {
      joinRoom();
    }

    return () => {
      socket.current?.off('connect', joinRoom);
    };
  }, [socket, roomId, user, request, emit]);

  // Track room users from socket events
  useEffect(() => {
    const cleanupRoomUsers = on('room-users', (users) => {
      setRoomUsers(users.filter(u => u.uuid !== user?.uuid));
    });
    const cleanupUserJoined = on('user-joined', (userData) => {
      if (userData.uuid === user?.uuid) return;
      setRoomUsers(prev => {
        const filtered = prev.filter(u => u.uuid !== userData.uuid);
        return [...filtered, userData];
      });
    });
    const cleanupUserLeft = on('user-left', (userData) => {
      setRoomUsers(prev => prev.filter(u => u.socketId !== userData.socketId));
    });
    return () => { cleanupRoomUsers(); cleanupUserJoined(); cleanupUserLeft(); };
  }, [on, user?.uuid]);

  // Widget updates
  useEffect(() => {
    const cleanupUpdate = on('widget-update', ({ uuid, type, data }) => {
      setWidgets(prev => ({ ...prev, [uuid]: { ...prev[uuid], [type]: data } }));
    });
    const cleanupStates = on('widget-states', (states) => {
      setWidgets(prev => ({ ...prev, ...states }));
    });
    return () => { cleanupUpdate(); cleanupStates(); };
  }, [on]);

  const openCamera = async (facing, blur) => {
    try {
      await ensureCameraPermission();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, frameRate: 8, facingMode: facing },
        audio: false,
      });
      const processed = blur
        ? createBlurredStream(stream, 8, 360, 6)
        : createCompressedStream(stream, 360, 6);
      cameraStreamRef.current = stream;
      setLocalStream(processed);
      setCameraOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = processed;
    } catch (err) {
      Toast.show({ content: '无法访问摄像头' });
    }
  };

  const startCamera = async () => {
    await openCamera(facingModeRef.current, blurOnRef.current);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setCameraOn(false);
    setLocalStream(null);
  };

  const flipCamera = async () => {
    if (!cameraOn) return;
    const newFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newFacing;
    setFacingMode(newFacing);
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    await openCamera(newFacing, blurOnRef.current);
  };

  const toggleBlur = async () => {
    const newBlur = !blurOnRef.current;
    blurOnRef.current = newBlur;
    setBlurOn(newBlur);
    if (!cameraOn || !cameraStreamRef.current) return;
    const processed = newBlur
      ? createBlurredStream(cameraStreamRef.current, 8, 360, 6)
      : createCompressedStream(cameraStreamRef.current, 360, 6);
    setLocalStream(processed);
    if (localVideoRef.current) localVideoRef.current.srcObject = processed;
  };

  const handleLeave = async () => {
    closeAll();
    localStream?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    emit('leave-room', {});
    await apiLeaveRoom(roomId, user.uuid);
    navigate('/rooms');
  };

  const handleEmojiChange = (emoji) => {
    setMyEmoji(emoji);
    emit('widget-update', { roomId, type: 'emoji', data: { emoji } });
  };

  const handleTimerUpdate = (timerData) => {
    setMyTimer(timerData);
    emit('widget-update', { roomId, type: 'clock', data: timerData });
  };

  const totalUsers = roomUsers.length + 1;
  const gridSize = totalUsers <= 2 ? 2 : totalUsers <= 4 ? 4 : 9;

  return (
    <div className="mobile-screen" style={{ background: '#eef4fb' }}>
      <NavBar
        onBack={handleLeave}
        style={{ background: '#dbeafe', color: '#1e3a5f', '--adm-color-text': '#1e3a5f' }}
        right={
          <Space>
            <Button
              size="mini"
              color={cameraOn ? 'primary' : 'default'}
              onClick={cameraOn ? stopCamera : startCamera}
            >
              📷
            </Button>
            {cameraOn && (
              <Button size="mini" onClick={flipCamera}>
                🔄
              </Button>
            )}
            {cameraOn && (
              <Button
                size="mini"
                color={blurOn ? 'primary' : 'default'}
                onClick={toggleBlur}
              >
                {blurOn ? '🔓' : '🔒'}
              </Button>
            )}
          </Space>
        }
      >
        自习室
      </NavBar>

      {connectionState === 'reconnecting' && (
        <div style={{ background: '#faad14', color: '#000', textAlign: 'center', padding: '2px 8px', fontSize: 11 }}>
          连接已断开，正在重连...
        </div>
      )}

      <div className="mobile-main" style={{ padding: 4, overflow: 'hidden' }}>
        <VideoGrid
          gridSize={gridSize}
          localVideoRef={localVideoRef}
          localStream={localStream}
          localUser={user}
          localEmoji={myEmoji}
          localTimer={myTimer}
          remoteStreams={remoteStreams}
          widgets={widgets}
          roomUsers={roomUsers}
        />
      </div>

      <Widgets
        emoji={myEmoji}
        timer={myTimer}
        onEmojiChange={handleEmojiChange}
        onTimerUpdate={handleTimerUpdate}
      />
    </div>
  );
}
