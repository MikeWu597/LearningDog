import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Button, Typography, Space, message, Layout, Descriptions } from 'antd';
import { ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons';
import { getUUID, setUUID, getUsername, setUsername } from '../utils/uuid';
import { apiLogin } from '../utils/api';
import { useApp } from '../App';

const { Title, Text } = Typography;
const { Header, Content } = Layout;

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [uuid, setUuidInput] = useState(getUUID() || '');
  const [username, setUsernameInput] = useState(getUsername() || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) {
      message.error('用户名不能为空');
      return;
    }
    setLoading(true);
    try {
      setUUID(uuid.trim());
      setUsername(username.trim());
      await apiLogin(uuid.trim(), username.trim());
      setUser({ uuid: uuid.trim(), username: username.trim() });
      message.success('设置已保存');
    } catch (err) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const copyUUID = () => {
    navigator.clipboard.writeText(uuid);
    message.success('UUID已复制到剪贴板');
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/rooms')} />
        <Title level={4} style={{ margin: '0 0 0 12px' }}>用户设置</Title>
      </Header>
      <Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Card title="账户信息">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>UUID (身份标识)</Text>
                <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                  <Input value={uuid} onChange={e => setUuidInput(e.target.value)} />
                  <Button icon={<CopyOutlined />} onClick={copyUUID}>复制</Button>
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  这是你的唯一身份标识。重装应用后输入此UUID可恢复账户。
                </Text>
              </div>
              <div>
                <Text strong>用户名</Text>
                <Input
                  value={username}
                  onChange={e => setUsernameInput(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </div>
              <Button type="primary" onClick={handleSave} loading={loading}>
                保存设置
              </Button>
            </Space>
          </Card>
        </div>
      </Content>
    </Layout>
  );
}
