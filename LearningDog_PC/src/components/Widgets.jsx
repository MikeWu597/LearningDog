import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Space, Popover, InputNumber, Input, Typography } from 'antd';
import { EditOutlined, ClockCircleOutlined, CaretRightOutlined, PauseOutlined, UndoOutlined } from '@ant-design/icons';

const { Text } = Typography;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Widgets({ emoji, timer, onEmojiChange, onTimerUpdate }) {
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
    <Space direction="vertical" size="small" style={{ width: 200 }}>
      <Text strong>设置状态</Text>
      <Input
        value={statusText}
        maxLength={6}
        placeholder="最多6个字"
        onChange={e => setStatusText(e.target.value)}
        onPressEnter={() => onEmojiChange(statusText.trim())}
      />
      <Space>
        <Button size="small" type="primary" onClick={() => onEmojiChange(statusText.trim())}>确定</Button>
        <Button size="small" onClick={() => { setStatusText(''); onEmojiChange(''); }}>清除</Button>
      </Space>
    </Space>
  );

  const timerContent = (
    <Space direction="vertical" size="small" style={{ width: 200 }}>
      <Text strong>计时器</Text>
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

  return (
    <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
      <Popover content={statusContent} title="设置状态" trigger="click" placement="top">
        <Button icon={<EditOutlined />} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none' }}>
          {emoji || '状态'}
        </Button>
      </Popover>
      <Popover content={timerContent} title="计时器" trigger="click" placement="top">
        <Button icon={<ClockCircleOutlined />} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none' }}>
          {timer?.running ? formatTime(localSeconds) : '计时器'}
        </Button>
      </Popover>
    </div>
  );
}
