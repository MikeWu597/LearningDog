import React, { useState } from 'react';
import { Card, Input, Button, Typography, Space, message, Tag } from 'antd';
import { CloudOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { setServerUrl, pingServer } from '../utils/server';

const { Title, Text } = Typography;

export default function ServerConfig({ onConnected }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState('');

  const handleTest = async () => {
    if (!url.trim()) {
      message.error('请输入服务器地址');
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
      message.error('请输入服务器地址');
      return;
    }
    setServerUrl(url);
    message.success('服务器已配置');
    onConnected();
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 420, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>🐕 LearningDog</Title>
            <Text type="secondary">配置服务器地址</Text>
          </div>
          <Input
            size="large"
            prefix={<CloudOutlined />}
            placeholder="输入服务器地址，如 https://example.com"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(''); setLatency(null); }}
            onPressEnter={handleTest}
          />
          <div style={{ minHeight: 24 }}>
            {testing && <Tag icon={<LoadingOutlined />} color="processing">正在测试连接...</Tag>}
            {latency !== null && <Tag icon={<CheckCircleOutlined />} color="success">连接正常 · 延迟 {latency}ms</Tag>}
            {error && <Tag color="error">{error}</Tag>}
          </div>
          <Space style={{ width: '100%' }} direction="vertical" size="small">
            <Button block onClick={handleTest} loading={testing}>
              测试连接
            </Button>
            <Button type="primary" size="large" block onClick={handleConnect} disabled={latency === null}>
              进入
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请向自习室管理员获取服务器地址
          </Text>
        </Space>
      </Card>
    </div>
  );
}
