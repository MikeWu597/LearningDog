import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, Button, Toast, Space } from 'antd-mobile';
import { useApp } from '../App';
import { apiLeaveRoom, apiStartFocus, apiStopFocus } from '../utils/api';
import { useWebRTC } from '../hooks/useWebRTC';
import { createCompressedStream, createBlurredStream } from '../utils/mediaProcessing';
import { ensureNativeCameraPermission } from '../utils/photoLibrary';
import { lockAppOrientation } from '../utils/orientation';
import VideoGrid from './VideoGrid';
import Widgets from './Widgets';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, socket, emit, on, request } = useApp();

  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [blurOn, setBlurOn] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [widgets, setWidgets] = useState({});
  const [myEmoji, setMyEmoji] = useState('');
  const [myTimer, setMyTimer] = useState({ mode: 'up', running: false, seconds: 0 });

  const localVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const facingModeRef = useRef('user');
  const blurOnRef = useRef(false);

  const { remoteStreams, closeAll } = useWebRTC({
    socket,
    localStream,
    roomId,
    sourceType: 'camera',
  });

  // Lock landscape on mount, restore portrait on unmount
  useEffect(() => {
    lockAppOrientation('landscape');
    return () => { lockAppOrientation('portrait'); };
  }, []);

  // Join room
  useEffect(() => {
    if (!socket.current || !user) return;

    const joinRoom = async () => {
      try {
        await request('join-room', { roomId, uuid: user.uuid, username: user.username });
      } catch (err) {
        Toast.show({ content: err.message || '加入房间失败' });
      }
    };

    if (socket.current.connected) {
      joinRoom();
    } else {
      socket.current.on('connect', joinRoom);
    }

    return () => {
      socket.current?.off('connect', joinRoom);
    };
  }, [socket, roomId, user, request]);

  // Widget updates
  useEffect(() => {
    const cleanup = on('widget-update', ({ uuid, type, data }) => {
      setWidgets(prev => ({ ...prev, [uuid]: { type, data } }));
    });
    return cleanup;
  }, [on]);

  const openCamera = async (facing, blur) => {
    try {
      await ensureNativeCameraPermission();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, frameRate: 12, facingMode: facing },
        audio: false,
      });
      const processed = blur
        ? createBlurredStream(stream, 8, 360, 10)
        : createCompressedStream(stream, 360, 10);
      cameraStreamRef.current = stream;
      setLocalStream(processed);
      setCameraOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = processed;
    } catch (err) {
      Toast.show({ content: err?.message || '无法访问摄像头' });
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
      ? createBlurredStream(cameraStreamRef.current, 8, 360, 10)
      : createCompressedStream(cameraStreamRef.current, 360, 10);
    setLocalStream(processed);
    if (localVideoRef.current) localVideoRef.current.srcObject = processed;
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
