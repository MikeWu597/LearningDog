import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, message, Layout, Typography, Tooltip, Modal } from 'antd';
import {
  CameraOutlined, DesktopOutlined, StopOutlined,
  ArrowLeftOutlined, SmileOutlined, ClockCircleOutlined,
  EyeOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useApp } from '../App';
import { apiLeaveRoom, apiStartFocus, apiStopFocus } from '../utils/api';
import { useWebRTC } from '../hooks/useWebRTC';
import { createBlurredStream, createCompressedStream } from '../utils/mediaProcessing';
import VideoGrid from './VideoGrid';
import Widgets from './Widgets';

const { Header, Content } = Layout;
const { Text } = Typography;

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, socket, emit, on, request } = useApp();

  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [screenBlur, setScreenBlur] = useState(false);
  const [localSourceType, setLocalSourceType] = useState(null);
  const [focusing, setFocusing] = useState(false);
  const [widgets, setWidgets] = useState({}); // { uuid: { type, data } }
  const [myEmoji, setMyEmoji] = useState('');
  const [myTimer, setMyTimer] = useState({ mode: 'up', running: false, seconds: 0 });

  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const { remoteStreams, closeAll } = useWebRTC({
    socket,
    localStream,
    roomId,
    sourceType: localSourceType || 'camera',
  });

  // Join room via socket on mount
  useEffect(() => {
    if (!socket.current || !user) return;

    const joinRoom = async () => {
      try {
        await request('join-room', { roomId, uuid: user.uuid, username: user.username });
      } catch (err) {
        message.error(err.message || '加入房间失败');
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

  // Listen for widget updates from other users
  useEffect(() => {
    const cleanup = on('widget-update', ({ uuid, type, data }) => {
      setWidgets(prev => ({ ...prev, [uuid]: { type, data } }));
    });
    return cleanup;
  }, [on]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 },
        audio: false,
      });
      const compressed = createCompressedStream(stream, 480, 12);
      cameraStreamRef.current = stream;
      setLocalStream(compressed);
      setLocalSourceType('camera');
      setCameraOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = compressed;
    } catch (err) {
      message.error('无法访问摄像头: ' + err.message);
    }
  };

  // Stop camera
  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setCameraOn(false);
    if (screenOn && screenStreamRef.current) {
      setLocalSourceType('screen');
    } else {
      setLocalSourceType(null);
      setLocalStream(null);
    }
  };

  // Start screen sharing (Electron only)
  const startScreen = async () => {
    try {
      let stream;
      if (window.electronAPI?.isElectron) {
        const sources = await window.electronAPI.getSources();
        // Show source picker modal - for simplicity, use first screen
        const screenSource = sources.find(s => s.id.startsWith('screen:')) || sources[0];
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id,
              maxWidth: 1280,
              maxFrameRate: 10,
            },
          },
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1280, height: 720, frameRate: 10 },
        });
      }

      const processed = screenBlur ? createBlurredStream(stream, 8) : createCompressedStream(stream, 1280, 10);
      screenStreamRef.current = stream;
      setLocalStream(processed);
      setLocalSourceType('screen');
      setScreenOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = processed;

      // Handle stream ending (user clicks stop in browser)
      stream.getVideoTracks()[0].onended = () => {
        stopScreen();
      };
    } catch (err) {
      message.error('无法共享屏幕: ' + err.message);
    }
  };

  // Stop screen sharing
  const stopScreen = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenOn(false);
    if (cameraOn && cameraStreamRef.current) {
      const compressed = createCompressedStream(cameraStreamRef.current, 480, 12);
      setLocalSourceType('camera');
      setLocalStream(compressed);
    } else {
      setLocalSourceType(null);
      setLocalStream(null);
    }
  };

  // Toggle screen blur
  const toggleScreenBlur = () => {
    const newBlur = !screenBlur;
    setScreenBlur(newBlur);
    if (screenOn && screenStreamRef.current) {
      const processed = newBlur
        ? createBlurredStream(screenStreamRef.current, 8)
        : createCompressedStream(screenStreamRef.current, 1280, 10);
      setLocalStream(processed);
      if (localVideoRef.current) localVideoRef.current.srcObject = processed;
    }
  };

  // Focus timer
  const toggleFocus = async () => {
    try {
      if (focusing) {
        await apiStopFocus(user.uuid);
        setFocusing(false);
        message.success('专注已结束');
      } else {
        await apiStartFocus(user.uuid, roomId);
        setFocusing(true);
        message.success('开始专注');
      }
    } catch (err) {
      message.error('操作失败');
    }
  };

  // Leave room
  const handleLeave = async () => {
    closeAll();
    localStream?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    emit('leave-room', {});
    if (focusing) {
      await apiStopFocus(user.uuid);
    }
    await apiLeaveRoom(roomId, user.uuid);
    navigate('/rooms');
  };

  // Send widget updates
  const handleEmojiChange = (emoji) => {
    setMyEmoji(emoji);
    emit('widget-update', { roomId, type: 'emoji', data: { emoji } });
  };

  const handleTimerUpdate = (timerData) => {
    setMyTimer(timerData);
    emit('widget-update', { roomId, type: 'clock', data: timerData });
  };

  // Calculate grid size
  const totalUsers = Object.keys(remoteStreams).length + 1;
  const gridSize = totalUsers <= 2 ? 2 : totalUsers <= 4 ? 4 : 9;

  return (
    <Layout style={{ height: '100vh', background: '#1a1a2e' }}>
      <Header style={{ background: '#16213e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleLeave} style={{ color: '#fff' }} />
          <Text style={{ color: '#fff', fontSize: 16 }}>自习室</Text>
        </Space>
        <Space>
          <Tooltip title={cameraOn ? '关闭摄像头' : '开启摄像头'}>
            <Button
              type={cameraOn ? 'primary' : 'default'}
              icon={<CameraOutlined />}
              onClick={cameraOn ? stopCamera : startCamera}
            />
          </Tooltip>
          <Tooltip title={screenOn ? '停止共享屏幕' : '共享屏幕'}>
            <Button
              type={screenOn ? 'primary' : 'default'}
              icon={<DesktopOutlined />}
              onClick={screenOn ? stopScreen : startScreen}
            />
          </Tooltip>
          {screenOn && (
            <Tooltip title={screenBlur ? '取消模糊' : '模糊屏幕'}>
              <Button
                type={screenBlur ? 'primary' : 'default'}
                icon={screenBlur ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={toggleScreenBlur}
              />
            </Tooltip>
          )}
          <Tooltip title={focusing ? '结束专注' : '开始专注'}>
            <Button
              type={focusing ? 'primary' : 'default'}
              danger={focusing}
              icon={<ClockCircleOutlined />}
              onClick={toggleFocus}
            >
              {focusing ? '专注中' : '专注'}
            </Button>
          </Tooltip>
        </Space>
      </Header>
      <Content style={{ padding: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
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
      </Content>
    </Layout>
  );
}
