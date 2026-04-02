import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Toast, Space } from 'antd-mobile';
import { getOrCreateUUID, setUUID, setUsername } from '../utils/uuid';
import { getServerUrl, pingServer } from '../utils/server';
import { apiLogin } from '../utils/api';
import { useApp } from '../App';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, disconnectServer } = useApp();
  const [uuid, setUuidInput] = useState(getOrCreateUUID());
  const [username, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState(null);
  const [pingError, setPingError] = useState(false);

  useEffect(() => {
    let alive = true;
    const measure = async () => {
      try {
        const ms = await pingServer(getServerUrl());
        if (alive) { setLatency(ms); setPingError(false); }
      } catch {
        if (alive) { setLatency(null); setPingError(true); }
      }
    };
    measure();
    const timer = setInterval(measure, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const handleLogin = async () => {
    if (!username.trim()) {
      Toast.show({ content: '请输入用户名', position: 'center' });
      return;
    }

    setLoading(true);
    try {
      setUUID(uuid.trim());
      setUsername(username.trim());
      await apiLogin(uuid.trim(), username.trim());
      setUser({ uuid: uuid.trim(), username: username.trim() });
      Toast.show({ content: '登录成功', position: 'center' });
      navigate('/rooms');
    } catch (err) {
      Toast.show({ content: '登录失败', position: 'center' });
    } finally {
      setLoading(false);
    }
  };

  const serverUrl = getServerUrl();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: 24, background: '#f5f5f5' }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🐕</div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>LearningDog</div>
          <div style={{ fontSize: 14, color: '#999' }}>在线自习室 · 互相监督</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 12 }}>
          <span style={{ color: '#999' }}>服务器: {serverUrl} </span>
          {latency !== null && <span style={{ color: '#52c41a' }}>· 延迟 {latency}ms</span>}
          {pingError && <span style={{ color: '#ff4d4f' }}>· 连接异常</span>}
          {latency === null && !pingError && <span style={{ color: '#1677ff' }}>· 检测中...</span>}
        </div>

        <Space direction="vertical" block style={{ '--gap': '12px' }}>
          <Input
            placeholder="输入用户名"
            value={username}
            onChange={setUsernameInput}
            style={{ '--font-size': '16px' }}
          />
          <Input
            placeholder="UUID (自动生成，可自定义)"
            value={uuid}
            onChange={setUuidInput}
            style={{ '--font-size': '14px' }}
          />
          <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            UUID是你的身份标识，重装后可输入原UUID恢复账户
          </div>
          <Button block color="primary" size="large" loading={loading} onClick={handleLogin}>
            进入自习室
          </Button>
          <Button block fill="none" size="small" onClick={disconnectServer}
            style={{ color: '#ff4d4f', fontSize: 13 }}>
            退出当前域
          </Button>
        </Space>
      </div>
    </div>
  );
}
