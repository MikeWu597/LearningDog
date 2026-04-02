import React, { useState, useEffect, useCallback } from 'react';
import { Button, Space, Popover, InputNumber, Radio, Typography } from 'antd';
import { SmileOutlined, ClockCircleOutlined, CaretRightOutlined, PauseOutlined, UndoOutlined } from '@ant-design/icons';

const { Text } = Typography;

const EMOJI_LIST = ['📚', '✍️', '💪', '🔥', '🎯', '⭐', '🧠', '💡', '☕', '🎵', '😴', '🤔', '😤', '🥳', '❤️', '👍'];

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

  const emojiContent = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: 200 }}>
      {EMOJI_LIST.map(e => (
        <Button
          key={e}
          type={emoji === e ? 'primary' : 'text'}
          style={{ fontSize: 24, height: 44 }}
          onClick={() => onEmojiChange(emoji === e ? '' : e)}
        >
          {e}
        </Button>
      ))}
    </div>
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
      <Popover content={emojiContent} title="选择 Emoji" trigger="click" placement="top">
        <Button icon={<SmileOutlined />} style={{ color: '#fff' }}>
          {emoji || 'Emoji'}
        </Button>
      </Popover>
      <Popover content={timerContent} title="计时器" trigger="click" placement="top">
        <Button icon={<ClockCircleOutlined />} style={{ color: '#fff' }}>
          {timer?.running ? formatTime(localSeconds) : '计时器'}
        </Button>
      </Popover>
    </div>
  );
}
