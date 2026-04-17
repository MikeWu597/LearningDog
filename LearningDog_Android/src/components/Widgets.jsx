import React, { useState, useEffect, useRef } from 'react';
import { Button, Popup, Stepper, Space, Input, Toast } from 'antd-mobile';
import { apiUploadFile, apiGetFiles, apiDeleteFile, getFileDownloadUrl } from '../utils/api';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Widgets({ emoji, timer, onEmojiChange, onTimerUpdate, uuid, files, onFilesChange, sharedFileId, onShareFile, onUnshareFile, messages, messageAcks, onSendMessage, onAckMessage, roomUsers }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [statusText, setStatusText] = useState(emoji || '');

  useEffect(() => { setStatusText(emoji || ''); }, [emoji]);
  const [localSeconds, setLocalSeconds] = useState(timer?.seconds || 0);
  const [countdownMinutes, setCountdownMinutes] = useState(25);

  useEffect(() => {
    if (!timer?.running) return;
    const interval = setInterval(() => {
      setLocalSeconds(prev => {
        const next = timer.mode === 'down' ? prev - 1 : prev + 1;
        if (timer.mode === 'down' && next <= 0) {
          onTimerUpdate({ ...timer, running: false, seconds: 0 });
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer?.running, timer?.mode]);

  // Periodic timer sync to server
  const localSecondsRef = useRef(localSeconds);
  useEffect(() => { localSecondsRef.current = localSeconds; }, [localSeconds]);
  useEffect(() => {
    if (!timer?.running) return;
    const syncId = setInterval(() => {
      onTimerUpdate({ ...timer, seconds: localSecondsRef.current });
    }, 10000);
    return () => clearInterval(syncId);
  }, [timer?.running, timer?.mode, onTimerUpdate]);

  const startTimer = (mode) => {
    const seconds = mode === 'down' ? countdownMinutes * 60 : 0;
    setLocalSeconds(seconds);
    onTimerUpdate({ mode, running: true, seconds });
  };

  const toggleTimer = () => {
    if (timer?.running) {
      onTimerUpdate({ ...timer, running: false, seconds: localSeconds });
    } else {
      onTimerUpdate({ ...timer, running: true, seconds: localSeconds });
    }
  };

  const resetTimer = () => {
    setLocalSeconds(0);
    onTimerUpdate({ mode: 'up', running: false, seconds: 0 });
  };

  // --- File management ---
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const result = await apiUploadFile(uuid, file);
      if (result.ok) {
        Toast.show({ content: '上传成功' });
        const updated = await apiGetFiles(uuid);
        onFilesChange(updated);
      } else {
        Toast.show({ content: result.error || '上传失败' });
      }
    } catch {
      Toast.show({ content: '上传失败' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (fileId) => {
    const result = await apiDeleteFile(fileId, uuid);
    if (result.ok) {
      const updated = await apiGetFiles(uuid);
      onFilesChange(updated);
      Toast.show({ content: '已删除' });
    }
  };

  const isPdf = (mimeType) => mimeType === 'application/pdf';
  const isAudio = (mimeType) => mimeType?.startsWith('audio/');
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // --- Message ---
  const [msgText, setMsgText] = useState('');
  const [msgDetailId, setMsgDetailId] = useState(null);

  const handleSendMsg = () => {
    const text = msgText.trim();
    if (!text) return;
    onSendMessage(text);
    setMsgText('');
  };

  return (
    <>
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
        background: '#dbeafe',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
      }}>
        <Button size="small" onClick={() => setStatusOpen(true)} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
          ✏️ {emoji || '状态'}
        </Button>
        <Button size="small" onClick={() => setTimerOpen(true)} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
          ⏱️ {timer?.running ? formatTime(localSeconds) : '计时器'}
        </Button>
        <Button size="small" onClick={() => setFileOpen(true)} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
          📁 文件
        </Button>
        <Button size="small" onClick={() => setMsgOpen(true)} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
          💬 消息{(messages || []).length > 0 ? ` (${(messages || []).length})` : ''}
        </Button>
      </div>

      {/* Status Popup */}
      <Popup visible={statusOpen} onMaskClick={() => setStatusOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16 }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 12 }}>设置状态</div>
        <Input
          value={statusText}
          maxLength={6}
          placeholder="最多6个字"
          onChange={val => setStatusText(val)}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['📚', '✍️', '💪', '🔥', '🎯', '😴', '🤔', '☕', '🧠', '🎵'].map(e => (
            <Button key={e} size="mini" style={{ fontSize: 18, padding: '4px 8px' }}
              onClick={() => { setStatusText(e); onEmojiChange(e); setStatusOpen(false); }}>{e}</Button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button block color="primary" onClick={() => { onEmojiChange(statusText.trim()); setStatusOpen(false); }}>确定</Button>
          <Button block onClick={() => { setStatusText(''); onEmojiChange(''); setStatusOpen(false); }}>清除</Button>
        </div>
      </Popup>

      {/* Timer Popup */}
      <Popup visible={timerOpen} onMaskClick={() => setTimerOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16 }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 12 }}>计时器</div>
        <div style={{ textAlign: 'center', fontSize: 32, fontFamily: 'monospace', marginBottom: 16 }}>
          {formatTime(localSeconds)}
        </div>
        <Space direction="vertical" block style={{ '--gap': '8px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button block onClick={() => startTimer('up')}>正计时</Button>
            <Button block onClick={() => startTimer('down')}>倒计时 {countdownMinutes}分钟</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span>倒计时分钟数:</span>
            <Stepper min={1} max={180} value={countdownMinutes} onChange={setCountdownMinutes} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button block color={timer?.running ? 'warning' : 'success'} onClick={toggleTimer}>
              {timer?.running ? '暂停' : '继续'}
            </Button>
            <Button block color="danger" onClick={resetTimer}>重置</Button>
          </div>
        </Space>
      </Popup>

      {/* File Popup */}
      <Popup visible={fileOpen} onMaskClick={() => setFileOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, maxHeight: '60vh', overflow: 'auto' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 12 }}>文件管理</div>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
        <Button block color="primary" onClick={() => fileInputRef.current?.click()} loading={uploading} style={{ marginBottom: 12 }}>
          📤 上传文件
        </Button>
        {(files || []).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>暂无文件</div>
        ) : (files || []).map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.originalName}</div>
              <div style={{ fontSize: 10, color: '#999' }}>{formatSize(f.size)}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {sharedFileId === f.id ? (
                <Button size="mini" color="danger" onClick={() => onUnshareFile()}>取消</Button>
              ) : (
                <Button size="mini" onClick={() => onShareFile(f.id, f.originalName, f.mimeType)}>共享</Button>
              )}
              {(isPdf(f.mimeType) || isAudio(f.mimeType)) && (
                <Button size="mini" onClick={() => { setPreviewFile(f); setFileOpen(false); }}>预览</Button>
              )}
              <a href={getFileDownloadUrl(f.id)} download><Button size="mini">下载</Button></a>
              <Button size="mini" color="danger" onClick={() => handleDeleteFile(f.id)}>删除</Button>
            </div>
          </div>
        ))}
      </Popup>

      {/* Message Popup */}
      <Popup visible={msgOpen} onMaskClick={() => setMsgOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, maxHeight: '60vh', overflow: 'auto' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 12 }}>消息</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <Input
            value={msgText}
            onChange={val => setMsgText(val)}
            placeholder="输入消息..."
            maxLength={200}
            style={{ flex: 1 }}
          />
          <Button color="primary" size="small" onClick={handleSendMsg}>发送</Button>
        </div>
        {(messages || []).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>暂无消息</div>
        ) : [...(messages || [])].reverse().map(msg => {
          const acks = (messageAcks || {})[msg.id] || [];
          const isMine = msg.senderUuid === uuid;
          const expanded = msgDetailId === msg.id;
          return (
            <div key={msg.id} style={{ marginBottom: 8, padding: '6px 8px', background: isMine ? '#e6f4ff' : '#f5f5f5', borderRadius: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <strong>{msg.senderName}</strong>
                <span style={{ color: '#999', fontSize: 10 }}>{msg.createdAt?.slice(11, 16)}</span>
              </div>
              <div style={{ marginBottom: 4 }}>{msg.content}</div>
              {isMine ? (
                <div>
                  <span style={{ color: '#1677ff', fontSize: 10, cursor: 'pointer' }}
                    onClick={() => setMsgDetailId(expanded ? null : msg.id)}>
                    签收 {acks.length}/{(roomUsers || []).length} {expanded ? '▲' : '▼'}
                  </span>
                  {expanded && (roomUsers || []).map(u => {
                    const ack = acks.find(a => a.userUuid === u.uuid);
                    return (
                      <div key={u.uuid} style={{ fontSize: 10, color: ack ? '#52c41a' : '#999' }}>
                        {u.username}: {ack ? `✅ ${ack.ackedAt?.slice(11, 16)}` : '⏳ 未签收'}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !(acks.find(a => a.userUuid === uuid)) && (
                  <Button size="mini" color="primary" onClick={() => onAckMessage(msg.id)}>签收</Button>
                )
              )}
            </div>
          );
        })}
      </Popup>

      {/* File preview overlay */}
      {previewFile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', color: '#fff' }}>
            <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{previewFile.originalName}</span>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              <a href={getFileDownloadUrl(previewFile.id)} download style={{ color: '#69b1ff', fontSize: 14 }}>💾</a>
              <span onClick={() => setPreviewFile(null)} style={{ cursor: 'pointer', fontSize: 18 }}>✕</span>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {isPdf(previewFile.mimeType) && (
              <iframe src={getFileDownloadUrl(previewFile.id, true)} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF" />
            )}
            {isAudio(previewFile.mimeType) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <audio controls src={getFileDownloadUrl(previewFile.id, true)} style={{ width: '80%' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
