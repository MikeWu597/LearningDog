import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, message, Layout, Typography, Tooltip, Modal } from 'antd';
import {
  CameraOutlined, DesktopOutlined,
  ArrowLeftOutlined,
  EyeOutlined, EyeInvisibleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useApp } from '../App';
import { apiLeaveRoom } from '../utils/api';
import { useWebRTC } from '../hooks/useWebRTC';
import { createBlurredStream, createCompressedStream } from '../utils/mediaProcessing';
import VideoGrid from './VideoGrid';
import Widgets from './Widgets';

const { Header, Content } = Layout;
const { Text } = Typography;

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, socket, emit, on, request, connectionState } = useApp();

  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [screenBlur, setScreenBlur] = useState(false);
  const [cameraBlur, setCameraBlur] = useState(false);
  const [localSourceType, setLocalSourceType] = useState(null);
  const [widgets, setWidgets] = useState({}); // { uuid: { type, data } }
  const [myEmoji, setMyEmoji] = useState('');
  const [myTimer, setMyTimer] = useState({ mode: 'up', running: false, seconds: 0 });
  const [roomUsers, setRoomUsers] = useState([]);

  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraBlurRef = useRef(false);
  const myEmojiRef = useRef('');
  const myTimerRef = useRef({ mode: 'up', running: false, seconds: 0 });

  const { remoteStreams, closeAll, trafficStats } = useWebRTC({
    socket,
    localStream,
    roomId,
    sourceType: localSourceType || 'camera',
    uuid: user?.uuid,
    username: user?.username,
  });

  // Keep refs in sync for reconnect widget sync
  useEffect(() => { myEmojiRef.current = myEmoji; }, [myEmoji]);
  useEffect(() => { myTimerRef.current = myTimer; }, [myTimer]);

  // Join room via socket on mount and on reconnect
  useEffect(() => {
    if (!socket.current || !user) return;

    let isFirstJoin = true;
    const joinRoom = async () => {
      try {
        await request('join-room', { roomId, uuid: user.uuid, username: user.username });
        // On reconnect, re-sync widget state
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
        message.error(err.message || '加入房间失败');
      }
    };

    // Always register for reconnect
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

  // Listen for widget updates from other users
  useEffect(() => {
    const cleanupUpdate = on('widget-update', ({ uuid, type, data }) => {
      setWidgets(prev => ({ ...prev, [uuid]: { ...prev[uuid], [type]: data } }));
    });
    const cleanupStates = on('widget-states', (states) => {
      setWidgets(prev => ({ ...prev, ...states }));
    });
    return () => { cleanupUpdate(); cleanupStates(); };
  }, [on]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 8 },
        audio: false,
      });
      const processed = cameraBlurRef.current
        ? createBlurredStream(stream, 8)
        : createCompressedStream(stream, 480, 8);
      cameraStreamRef.current = stream;
      setLocalStream(processed);
      setLocalSourceType('camera');
      setCameraOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = processed;
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

  // Toggle camera blur
  const toggleCameraBlur = () => {
    const newBlur = !cameraBlurRef.current;
    cameraBlurRef.current = newBlur;
    setCameraBlur(newBlur);
    if (cameraOn && cameraStreamRef.current) {
      const processed = newBlur
        ? createBlurredStream(cameraStreamRef.current, 8)
        : createCompressedStream(cameraStreamRef.current, 480, 8);
      setLocalStream(processed);
      if (localVideoRef.current) localVideoRef.current.srcObject = processed;
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
              maxFrameRate: 6,
            },
          },
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1280, height: 720, frameRate: 6 },
        });
      }

      const processed = screenBlur ? createBlurredStream(stream, 8) : createCompressedStream(stream, 1280, 6);
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

  // Leave room
  const handleLeave = async () => {
    closeAll();
    localStream?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    emit('leave-room', {});
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

  const [showTraffic, setShowTraffic] = useState(false);
  const formatBytes = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const formatRate = (b) => b < 1024 ? b + ' B/s' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB/s' : (b / 1048576).toFixed(1) + ' MB/s';

  // Calculate grid size
  const totalUsers = roomUsers.length + 1;
  const gridSize = totalUsers <= 2 ? 2 : totalUsers <= 4 ? 4 : 9;

  return (
    <Layout style={{ height: '100vh', background: '#eef4fb' }}>
      <Header style={{ background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleLeave} style={{ color: '#1e3a5f' }} />
          <Text style={{ color: '#1e3a5f', fontSize: 16 }}>自习室</Text>
        </Space>
        <Space>
          <Tooltip title={cameraOn ? '关闭摄像头' : '开启摄像头'}>
            <Button
              type={cameraOn ? 'primary' : 'default'}
              icon={<CameraOutlined />}
              onClick={cameraOn ? stopCamera : startCamera}
            />
          </Tooltip>
          {cameraOn && (
            <Tooltip title={cameraBlur ? '取消摄像头模糊' : '模糊摄像头'}>
              <Button
                type={cameraBlur ? 'primary' : 'default'}
                icon={cameraBlur ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={toggleCameraBlur}
              />
            </Tooltip>
          )}
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
          <Tooltip title="流量统计">
            <Button
              type={showTraffic ? 'primary' : 'default'}
              icon={<BarChartOutlined />}
              onClick={() => setShowTraffic(v => !v)}
            />
          </Tooltip>
        </Space>
      </Header>
      {showTraffic && (
        <div style={{ background: '#dbeafe', display: 'flex', justifyContent: 'center', gap: 24, padding: '4px 16px', fontSize: 12, color: '#1e3a5f' }}>
          <span>↑ {formatRate(trafficStats.sendRate)}</span>
          <span>↓ {formatRate(trafficStats.recvRate)}</span>
          <span>已发送 {formatBytes(trafficStats.sent)}</span>
          <span>已接收 {formatBytes(trafficStats.received)}</span>
        </div>
      )}
      {connectionState === 'reconnecting' && (
        <div style={{ background: '#faad14', color: '#000', textAlign: 'center', padding: '4px 8px', fontSize: 12 }}>
          连接已断开，正在重连...
        </div>
      )}
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
            roomUsers={roomUsers}
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
