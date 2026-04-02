import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, Button, Toast, Space } from 'antd-mobile';
import { useApp } from '../App';
import { apiLeaveRoom, apiStartFocus, apiStopFocus } from '../utils/api';
import { useWebRTC } from '../hooks/useWebRTC';
import { createCompressedStream } from '../utils/mediaProcessing';
import VideoGrid from './VideoGrid';
import Widgets from './Widgets';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, socket, emit, on } = useApp();

  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [widgets, setWidgets] = useState({});
  const [myEmoji, setMyEmoji] = useState('');
  const [myTimer, setMyTimer] = useState({ mode: 'up', running: false, seconds: 0 });

  const localVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const { remoteStreams, closeAll } = useWebRTC({
    socket,
    localStream,
    roomId,
    uuid: user?.uuid,
    username: user?.username,
  });

  // Join room
  useEffect(() => {
    if (!socket.current || !user) return;

    const joinRoom = () => {
      emit('join-room', { roomId, uuid: user.uuid, username: user.username });
    };

    if (socket.current.connected) {
      joinRoom();
    } else {
      socket.current.on('connect', joinRoom);
    }

    return () => {
      socket.current?.off('connect', joinRoom);
    };
  }, [socket, roomId, user, emit]);

  // Widget updates
  useEffect(() => {
    const cleanup = on('widget-update', ({ uuid, type, data }) => {
      setWidgets(prev => ({ ...prev, [uuid]: { type, data } }));
    });
    return cleanup;
  }, [on]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, frameRate: 12, facingMode: 'user' },
        audio: false,
      });
      const compressed = createCompressedStream(stream, 360, 10);
      cameraStreamRef.current = stream;
      setLocalStream(compressed);
      setCameraOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = compressed;
    } catch (err) {
      Toast.show({ content: '无法访问摄像头' });
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setCameraOn(false);
    setLocalStream(null);
  };

  const toggleFocus = async () => {
    try {
      if (focusing) {
        await apiStopFocus(user.uuid);
        setFocusing(false);
        Toast.show({ content: '专注已结束' });
      } else {
        await apiStartFocus(user.uuid, roomId);
        setFocusing(true);
        Toast.show({ content: '开始专注' });
      }
    } catch (err) {
      Toast.show({ content: '操作失败' });
    }
  };

  const handleLeave = async () => {
    closeAll();
    localStream?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    emit('leave-room', {});
    if (focusing) await apiStopFocus(user.uuid);
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

  const totalUsers = Object.keys(remoteStreams).length + 1;
  const gridSize = totalUsers <= 2 ? 2 : totalUsers <= 4 ? 4 : 9;

  return (
    <div className="mobile-screen mobile-screen-dark">
      <NavBar
        onBack={handleLeave}
        style={{ background: '#16213e', color: '#fff', '--adm-color-text': '#fff' }}
        right={
          <Space>
            <Button
              size="mini"
              color={cameraOn ? 'primary' : 'default'}
              onClick={cameraOn ? stopCamera : startCamera}
            >
              📷
            </Button>
            <Button
              size="mini"
              color={focusing ? 'danger' : 'default'}
              onClick={toggleFocus}
            >
              {focusing ? '⏹' : '▶️'}
            </Button>
          </Space>
        }
      >
        自习室
      </NavBar>

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
