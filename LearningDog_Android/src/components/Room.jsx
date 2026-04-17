import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, Button, Toast, Space } from 'antd-mobile';
import { useApp } from '../App';
import { apiLeaveRoom, apiGetFiles, getFileDownloadUrl } from '../utils/api';
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
  const [myFiles, setMyFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState({});
  const [mySharedFileId, setMySharedFileId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageAcks, setMessageAcks] = useState({});
  const [incomingMsg, setIncomingMsg] = useState(null);

  const localVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const facingModeRef = useRef('user');
  const blurOnRef = useRef(true);
  const myEmojiRef = useRef('');
  const myTimerRef = useRef({ mode: 'up', running: false, seconds: 0 });

  const { remoteStreams, closeAll, trafficStats } = useWebRTC({
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

  // Load user files
  useEffect(() => {
    if (user?.uuid) apiGetFiles(user.uuid).then(setMyFiles).catch(() => {});
  }, [user?.uuid]);

  // File share events
  useEffect(() => {
    const c1 = on('file-share', ({ uuid, fileId, originalName, mimeType }) => {
      setSharedFiles(prev => ({ ...prev, [uuid]: { fileId, originalName, mimeType } }));
    });
    const c2 = on('file-unshare', ({ uuid }) => {
      setSharedFiles(prev => { const n = { ...prev }; delete n[uuid]; return n; });
    });
    const c3 = on('shared-files-state', (state) => {
      setSharedFiles(prev => ({ ...prev, ...state }));
    });
    return () => { c1(); c2(); c3(); };
  }, [on]);

  // Message events
  useEffect(() => {
    const c1 = on('room-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (msg.senderUuid !== user?.uuid) setIncomingMsg(msg);
    });
    const c2 = on('message-ack', ({ messageId, userUuid, username, ackedAt }) => {
      setMessageAcks(prev => {
        const existing = prev[messageId] || [];
        if (existing.find(a => a.userUuid === userUuid)) return prev;
        return { ...prev, [messageId]: [...existing, { userUuid, username, ackedAt }] };
      });
    });
    const c3 = on('room-messages-history', ({ messages: msgs, acks }) => {
      setMessages(msgs);
      setMessageAcks(acks || {});
    });
    return () => { c1(); c2(); c3(); };
  }, [on, user?.uuid]);

  // Force camera off (face detection)
  useEffect(() => {
    const cleanup = on('force-camera-off', ({ reason }) => {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      setCameraOn(false);
      setLocalStream(null);
      Toast.show({ content: reason || '检测到人脸，摄像头已关闭' });
    });
    return cleanup;
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

  // File sharing
  const handleShareFile = (fileId, originalName, mimeType) => {
    setMySharedFileId(fileId);
    emit('file-share', { roomId, fileId, originalName, mimeType });
  };
  const handleUnshareFile = () => {
    setMySharedFileId(null);
    emit('file-unshare', { roomId });
  };

  // Messaging
  const handleSendMessage = (content) => { emit('room-message', { roomId, content }); };
  const handleAckMessage = (messageId) => { emit('message-ack', { messageId, roomId }); };

  const handleLeave = async () => {
    closeAll();
    localStream?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    emit('leave-room', {});
    setMessages([]); setMessageAcks({}); setSharedFiles({}); setMySharedFileId(null);
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

  const [showTraffic, setShowTraffic] = useState(false);
  const formatBytes = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const formatRate = (b) => b < 1024 ? b + ' B/s' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB/s' : (b / 1048576).toFixed(1) + ' MB/s';

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
            <Button size="mini" color={showTraffic ? 'primary' : 'default'} onClick={() => setShowTraffic(v => !v)}>
              📊
            </Button>
          </Space>
        }
      >
        自习室
      </NavBar>

      {showTraffic && (
        <div style={{ background: '#dbeafe', display: 'flex', justifyContent: 'center', gap: 12, padding: '3px 8px', fontSize: 10, color: '#1e3a5f' }}>
          <span>↑ {formatRate(trafficStats.sendRate)}</span>
          <span>↓ {formatRate(trafficStats.recvRate)}</span>
          <span>已发 {formatBytes(trafficStats.sent)}</span>
          <span>已收 {formatBytes(trafficStats.received)}</span>
        </div>
      )}

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
          sharedFiles={sharedFiles}
          mySharedFileId={mySharedFileId}
        />
      </div>

      <Widgets
        emoji={myEmoji}
        timer={myTimer}
        onEmojiChange={handleEmojiChange}
        onTimerUpdate={handleTimerUpdate}
        uuid={user?.uuid}
        files={myFiles}
        onFilesChange={setMyFiles}
        sharedFileId={mySharedFileId}
        onShareFile={handleShareFile}
        onUnshareFile={handleUnshareFile}
        messages={messages}
        messageAcks={messageAcks}
        onSendMessage={handleSendMessage}
        onAckMessage={handleAckMessage}
        roomUsers={roomUsers}
      />

      {/* Incoming message dialog */}
      {incomingMsg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, margin: 20, maxWidth: 320, width: '80%' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>来自 {incomingMsg.senderName} 的消息</div>
            <div style={{ fontSize: 16, marginBottom: 16 }}>{incomingMsg.content}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button block color="primary" onClick={() => { handleAckMessage(incomingMsg.id); setIncomingMsg(null); }}>签收</Button>
              <Button block onClick={() => setIncomingMsg(null)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
