import React, { useState } from 'react';
import { Button, Input, Toast, Space, Tag } from 'antd-mobile';
import { setServerUrl, pingServer } from '../utils/server';

export default function ServerConfig({ onConnected }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState('');

  const handleTest = async () => {
    if (!url.trim()) {
      Toast.show({ content: '请输入服务器地址', position: 'center' });
      return;
    }
    setTesting(true);
    setError('');
    setLatency(null);
    try {
      const ms = await pingServer(url);
      setLatency(ms);
    } catch (err) {
      setError('无法连接到服务器');
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = () => {
    if (!url.trim()) {
      Toast.show({ content: '请输入服务器地址', position: 'center' });
      return;
    }
    setServerUrl(url);
    Toast.show({ content: '服务器已配置', position: 'center' });
    onConnected();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: 24, background: '#f5f5f5' }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🐕</div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>LearningDog</div>
          <div style={{ fontSize: 14, color: '#999' }}>配置服务器地址</div>
        </div>

        <Space direction="vertical" block style={{ '--gap': '12px' }}>
          <Input
            placeholder="输入服务器地址，如 https://example.com"
            value={url}
            onChange={val => { setUrl(val); setError(''); setLatency(null); }}
            style={{ '--font-size': '15px' }}
          />
          <div style={{ textAlign: 'center', minHeight: 24, fontSize: 13 }}>
            {testing && <span style={{ color: '#1677ff' }}>正在测试连接...</span>}
            {latency !== null && <span style={{ color: '#52c41a' }}>✓ 连接正常 · 延迟 {latency}ms</span>}
            {error && <span style={{ color: '#ff4d4f' }}>✗ {error}</span>}
          </div>
          <Button block onClick={handleTest} loading={testing}>测试连接</Button>
          <Button block color="primary" size="large" onClick={handleConnect} disabled={latency === null}>
            进入
          </Button>
          <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            请向自习室管理员获取服务器地址
          </div>
        </Space>
      </div>
    </div>
  );
}
