import React, { useState, useEffect, useRef } from 'react';
import { Button, Popup, Stepper, Space, Input } from 'antd-mobile';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Widgets({ emoji, timer, onEmojiChange, onTimerUpdate }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
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
    </>
  );
}
