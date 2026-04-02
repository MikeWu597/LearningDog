import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Button, Typography, Space, message, Tag } from 'antd';
import { UserOutlined, KeyOutlined, DisconnectOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { getOrCreateUUID, setUUID, setUsername } from '../utils/uuid';
import { getServerUrl, pingServer } from '../utils/server';
import { apiLogin } from '../utils/api';
import { useApp } from '../App';

const { Title, Text } = Typography;

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
      message.error('请输入用户名');
      return;
    }
    if (!uuid.trim()) {
      message.error('请输入UUID');
      return;
    }

    setLoading(true);
    try {
      setUUID(uuid.trim());
      setUsername(username.trim());
      const user = await apiLogin(uuid.trim(), username.trim());
      setUser({ uuid: uuid.trim(), username: username.trim() });
      message.success('登录成功');
      navigate('/rooms');
    } catch (err) {
      message.error('登录失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const serverUrl = getServerUrl();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>🐕 LearningDog</Title>
            <Text type="secondary">在线自习室 · 互相监督</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>服务器: {serverUrl}</Text>
            {latency !== null && <Tag icon={<CheckCircleOutlined />} color="success">延迟 {latency}ms</Tag>}
            {pingError && <Tag icon={<CloseCircleOutlined />} color="error">连接异常</Tag>}
            {latency === null && !pingError && <Tag icon={<LoadingOutlined />} color="processing">检测中</Tag>}
          </div>
          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder="输入用户名"
            value={username}
            onChange={e => setUsernameInput(e.target.value)}
            onPressEnter={handleLogin}
          />
          <Input
            size="large"
            prefix={<KeyOutlined />}
            placeholder="UUID (自动生成，可自定义)"
            value={uuid}
            onChange={e => setUuidInput(e.target.value)}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            UUID是你的身份标识，重装后可输入原UUID恢复账户
          </Text>
          <Button type="primary" size="large" block loading={loading} onClick={handleLogin}>
            进入自习室
          </Button>
          <Button type="link" danger icon={<DisconnectOutlined />} onClick={disconnectServer}>
            退出当前域
          </Button>
        </Space>
      </Card>
    </div>
  );
}
