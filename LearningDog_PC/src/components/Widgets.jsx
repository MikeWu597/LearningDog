import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Space, Popover, InputNumber, Input, Typography, Upload, List, Modal, message } from 'antd';
import { EditOutlined, ClockCircleOutlined, CaretRightOutlined, PauseOutlined, UndoOutlined, FolderOutlined, MessageOutlined, UploadOutlined, DeleteOutlined, ShareAltOutlined, DownloadOutlined, StopOutlined } from '@ant-design/icons';
import { apiUploadFile, apiGetFiles, apiDeleteFile, getFileDownloadUrl } from '../utils/api';

const { Text } = Typography;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Widgets({ emoji, timer, onEmojiChange, onTimerUpdate, uuid, files, onFilesChange, sharedFileId, onShareFile, onUnshareFile, messages, messageAcks, onSendMessage, onAckMessage, roomUsers }) {
  const [localSeconds, setLocalSeconds] = useState(timer?.seconds || 0);
  const [countdownMinutes, setCountdownMinutes] = useState(25);

  // Sync local timer
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

  const [statusText, setStatusText] = useState(emoji || '');

  useEffect(() => { setStatusText(emoji || ''); }, [emoji]);

  const statusContent = (
    <Space direction="vertical" size="small" style={{ width: 220 }}>
      <Input
        value={statusText}
        maxLength={6}
        placeholder="最多6个字"
        onChange={e => setStatusText(e.target.value)}
        onPressEnter={() => onEmojiChange(statusText.trim())}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {['📚', '✍️', '💪', '🔥', '🎯', '😴', '🤔', '☕', '🧠', '🎵'].map(e => (
          <Button key={e} size="small" type="text" style={{ fontSize: 18, padding: '2px 6px', minWidth: 0 }}
            onClick={() => { setStatusText(e); onEmojiChange(e); }}>{e}</Button>
        ))}
      </div>
      <Space>
        <Button size="small" type="primary" onClick={() => onEmojiChange(statusText.trim())}>确定</Button>
        <Button size="small" onClick={() => { setStatusText(''); onEmojiChange(''); }}>清除</Button>
      </Space>
    </Space>
  );

  const timerContent = (
    <Space direction="vertical" size="small" style={{ width: 200 }}>
      <div style={{ textAlign: 'center', fontSize: 24, fontFamily: 'monospace' }}>
        {formatTime(localSeconds)}
      </div>
      <Space>
        <Button size="small" onClick={() => startTimer('up')}>正计时</Button>
        <Space.Compact>
          <InputNumber
            size="small"
            min={1}
            max={180}
            value={countdownMinutes}
            onChange={setCountdownMinutes}
            style={{ width: 60 }}
          />
          <Button size="small" onClick={() => startTimer('down')}>倒计时</Button>
        </Space.Compact>
      </Space>
      <Space>
        <Button
          size="small"
          icon={timer?.running ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={toggleTimer}
          disabled={!timer?.mode && localSeconds === 0}
        >
          {timer?.running ? '暂停' : '继续'}
        </Button>
        <Button size="small" icon={<UndoOutlined />} onClick={resetTimer}>重置</Button>
      </Space>
    </Space>
  );

  // --- File management ---
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => { setFileList(files || []); }, [files]);

  const handleUpload = async (info) => {
    if (info.file.status === 'uploading') {
      setUploading(true);
      return;
    }
  };

  const customUpload = async ({ file, onSuccess, onError }) => {
    try {
      setUploading(true);
      const result = await apiUploadFile(uuid, file);
      if (result.ok) {
        onSuccess(result);
        message.success('上传成功');
        // Reload files
        const updated = await apiGetFiles(uuid);
        onFilesChange(updated);
      } else {
        onError(new Error(result.error));
        message.error(result.error || '上传失败');
      }
    } catch (err) {
      onError(err);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    const result = await apiDeleteFile(fileId, uuid);
    if (result.ok) {
      const updated = await apiGetFiles(uuid);
      onFilesChange(updated);
      message.success('已删除');
    }
  };

  const isPdf = (mimeType) => mimeType === 'application/pdf';
  const isAudio = (mimeType) => mimeType?.startsWith('audio/');

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const fileContent = (
    <div style={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
      <Upload customRequest={customUpload} showUploadList={false} onChange={handleUpload}>
        <Button icon={<UploadOutlined />} size="small" loading={uploading} block style={{ marginBottom: 8 }}>上传文件</Button>
      </Upload>
      {(files || []).length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>暂无文件</div>
      ) : (
        <List size="small" dataSource={files || []} renderItem={f => (
          <List.Item
            actions={[
              sharedFileId === f.id
                ? <Button key="unshare" size="small" icon={<StopOutlined />} onClick={() => onUnshareFile()} danger type="text" title="取消共享" />
                : <Button key="share" size="small" icon={<ShareAltOutlined />} onClick={() => onShareFile(f.id, f.originalName, f.mimeType)} type="text" title="共享" />,
              (isPdf(f.mimeType) || isAudio(f.mimeType)) &&
                <Button key="preview" size="small" type="text" onClick={() => setPreviewFile(f)} title="预览">👁</Button>,
              <a key="dl" href={getFileDownloadUrl(f.id)} download><Button size="small" icon={<DownloadOutlined />} type="text" title="下载" /></a>,
              <Button key="del" size="small" icon={<DeleteOutlined />} type="text" danger onClick={() => handleDeleteFile(f.id)} title="删除" />,
            ].filter(Boolean)}
          >
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }} title={f.originalName}>
              {f.originalName}
            </div>
            <div style={{ fontSize: 10, color: '#999' }}>{formatSize(f.size)}</div>
          </List.Item>
        )} />
      )}
    </div>
  );

  // --- Message system ---
  const [msgText, setMsgText] = useState('');
  const [msgDetailId, setMsgDetailId] = useState(null);

  const handleSendMsg = () => {
    const text = msgText.trim();
    if (!text) return;
    onSendMessage(text);
    setMsgText('');
  };

  const msgContent = (
    <div style={{ width: 340, maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Input
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          onPressEnter={handleSendMsg}
          placeholder="输入消息..."
          size="small"
          maxLength={200}
        />
        <Button size="small" type="primary" onClick={handleSendMsg}>发送</Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', maxHeight: 340 }}>
        {(messages || []).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>暂无消息</div>
        ) : (
          [...(messages || [])].reverse().map(msg => {
            const acks = (messageAcks || {})[msg.id] || [];
            const isMine = msg.senderUuid === uuid;
            const expanded = msgDetailId === msg.id;
            return (
              <div key={msg.id} style={{ marginBottom: 8, padding: '6px 8px', background: isMine ? '#e6f4ff' : '#f5f5f5', borderRadius: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text strong style={{ fontSize: 12 }}>{msg.senderName}</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>{msg.createdAt?.slice(11, 16)}</Text>
                </div>
                <div style={{ marginBottom: 4 }}>{msg.content}</div>
                {isMine ? (
                  <div>
                    <Button size="small" type="link" style={{ padding: 0, fontSize: 10 }}
                      onClick={() => setMsgDetailId(expanded ? null : msg.id)}>
                      签收 {acks.length}/{(roomUsers || []).length} {expanded ? '▲' : '▼'}
                    </Button>
                    {expanded && (
                      <div style={{ marginTop: 4 }}>
                        {(roomUsers || []).map(u => {
                          const ack = acks.find(a => a.userUuid === u.uuid);
                          return (
                            <div key={u.uuid} style={{ fontSize: 10, color: ack ? '#52c41a' : '#999' }}>
                              {u.username}: {ack ? `✅ ${ack.ackedAt?.slice(11, 16)}` : '⏳ 未签收'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  !(acks.find(a => a.userUuid === uuid)) && (
                    <Button size="small" type="primary" onClick={() => onAckMessage(msg.id)} style={{ fontSize: 10, height: 22 }}>签收</Button>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
        <Popover content={statusContent} title="设置状态" trigger="click" placement="top">
          <Button icon={<EditOutlined />} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
            {emoji || '状态'}
          </Button>
        </Popover>
        <Popover content={timerContent} title="计时器" trigger="click" placement="top">
          <Button icon={<ClockCircleOutlined />} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
            {timer?.running ? formatTime(localSeconds) : '计时器'}
          </Button>
        </Popover>
        <Popover content={fileContent} title="文件管理" trigger="click" placement="top">
          <Button icon={<FolderOutlined />} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
            文件
          </Button>
        </Popover>
        <Popover content={msgContent} title="消息" trigger="click" placement="top">
          <Button icon={<MessageOutlined />} style={{ color: '#1e3a5f', background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe' }}>
            消息{(messages || []).length > 0 ? ` (${(messages || []).length})` : ''}
          </Button>
        </Popover>
      </div>
      {/* File preview modal */}
      <Modal
        open={!!previewFile}
        onCancel={() => setPreviewFile(null)}
        footer={[
          <a key="dl" href={previewFile ? getFileDownloadUrl(previewFile.id) : '#'} download>
            <Button icon={<DownloadOutlined />}>另存为</Button>
          </a>,
          <Button key="close" onClick={() => setPreviewFile(null)}>关闭</Button>,
        ]}
        title={previewFile?.originalName}
        width={720}
        styles={{ body: { padding: 0, height: 500 } }}
      >
        {previewFile && isPdf(previewFile.mimeType) && (
          <iframe
            src={getFileDownloadUrl(previewFile.id, true)}
            style={{ width: '100%', height: 500, border: 'none' }}
            title={previewFile.originalName}
          />
        )}
        {previewFile && isAudio(previewFile.mimeType) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500 }}>
            <audio controls src={getFileDownloadUrl(previewFile.id, true)} style={{ width: '80%' }} />
          </div>
        )}
      </Modal>
    </>
  );
}
