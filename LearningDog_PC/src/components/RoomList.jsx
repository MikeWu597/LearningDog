import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, List, Typography, Modal, Input, Select, Space, Tag, message, Layout } from 'antd';
import { PlusOutlined, UserOutlined, SettingOutlined, BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiGetRooms, apiCreateRoom, apiJoinRoom } from '../utils/api';
import { useApp } from '../App';

const { Title, Text } = Typography;
const { Header, Content } = Layout;

export default function RoomList() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxUsers, setMaxUsers] = useState(4);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const data = await apiGetRooms();
      setRooms(data);
    } catch (err) {
      message.error('获取房间列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      message.error('请输入房间名');
      return;
    }
    try {
      const room = await apiCreateRoom(roomName.trim(), maxUsers);
      message.success('房间创建成功');
      setModalOpen(false);
      setRoomName('');
      fetchRooms();
    } catch (err) {
      message.error('创建房间失败');
    }
  };

  const handleJoin = async (roomId) => {
    try {
      await apiJoinRoom(roomId, user.uuid);
      navigate(`/room/${roomId}`);
    } catch (err) {
      message.error('加入房间失败: ' + (err.message || ''));
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Title level={4} style={{ margin: 0 }}>🐕 LearningDog</Title>
        <Space>
          <Text>👋 {user?.username}</Text>
          <Button icon={<BarChartOutlined />} onClick={() => navigate('/records')}>学习记录</Button>
          <Button icon={<SettingOutlined />} onClick={() => navigate('/settings')}>设置</Button>
        </Space>
      </Header>
      <Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Title level={3}>自习室列表</Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchRooms}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建房间</Button>
            </Space>
          </div>

          <List
            loading={loading}
            dataSource={rooms}
            locale={{ emptyText: '暂无自习室，点击上方按钮创建' }}
            renderItem={room => (
              <Card style={{ marginBottom: 12 }} hoverable onClick={() => handleJoin(room.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>{room.name}</Title>
                    <Text type="secondary">
                      <UserOutlined /> {room.currentUsers}/{room.max_users} 人
                    </Text>
                  </div>
                  <Tag color={room.currentUsers >= room.max_users ? 'red' : 'green'}>
                    {room.currentUsers >= room.max_users ? '已满' : '可加入'}
                  </Tag>
                </div>
              </Card>
            )}
          />
        </div>

        <Modal
          title="创建自习室"
          open={modalOpen}
          onOk={handleCreate}
          onCancel={() => setModalOpen(false)}
          okText="创建"
          cancelText="取消"
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Input placeholder="房间名称" value={roomName} onChange={e => setRoomName(e.target.value)} />
            <Select value={maxUsers} onChange={setMaxUsers} style={{ width: '100%' }}>
              <Select.Option value={2}>二宫格 (2人)</Select.Option>
              <Select.Option value={4}>四宫格 (4人)</Select.Option>
              <Select.Option value={9}>九宫格 (9人)</Select.Option>
            </Select>
          </Space>
        </Modal>
      </Content>
    </Layout>
  );
}
