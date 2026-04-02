import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, List, Button, Input, Toast, Tag, Space, PullToRefresh, Popup } from 'antd-mobile';
import { apiGetRooms, apiCreateRoom, apiJoinRoom } from '../utils/api';
import { useApp } from '../App';

export default function RoomList() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxUsers, setMaxUsers] = useState(4);
  const [createVisible, setCreateVisible] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const data = await apiGetRooms();
      setRooms(data);
    } catch (err) {
      Toast.show({ content: '获取房间列表失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const openCreatePopup = () => {
    setRoomName('');
    setMaxUsers(4);
    setCreateVisible(true);
  };

  const handleCreate = async () => {
    if (!roomName.trim()) {
      Toast.show({ content: '请输入房间名称' });
      return;
    }

    try {
      await apiCreateRoom(roomName.trim(), maxUsers);
      Toast.show({ content: '房间创建成功' });
      setCreateVisible(false);
      setRoomName('');
      fetchRooms();
    } catch (err) {
      Toast.show({ content: '创建失败' });
    }
  };

  const handleJoin = async (roomId) => {
    try {
      await apiJoinRoom(roomId, user.uuid);
      navigate(`/room/${roomId}`);
    } catch (err) {
      Toast.show({ content: '加入失败' });
    }
  };

  return (
    <div className="mobile-screen mobile-screen-light">
      <NavBar
        back={null}
        right={
          <Space>
            <Button size="mini" onClick={() => navigate('/records')}>📊</Button>
            <Button size="mini" onClick={() => navigate('/settings')}>⚙️</Button>
          </Space>
        }
      >
        🐕 LearningDog
      </NavBar>

      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>👋 {user?.username}</span>
        <Button size="small" color="primary" onClick={openCreatePopup}>+ 创建房间</Button>
      </div>

      <div className="mobile-main" style={{ overflow: 'auto' }}>
        <PullToRefresh onRefresh={fetchRooms}>
          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
              暂无自习室，点击上方按钮创建
            </div>
          ) : (
            <List>
              {rooms.map(room => (
                <List.Item
                  key={room.id}
                  onClick={() => handleJoin(room.id)}
                  description={`${room.currentUsers}/${room.max_users} 人`}
                  extra={
                    <Tag color={room.currentUsers >= room.max_users ? 'danger' : 'success'}>
                      {room.currentUsers >= room.max_users ? '已满' : '加入'}
                    </Tag>
                  }
                >
                  {room.name}
                </List.Item>
              ))}
            </List>
          )}
        </PullToRefresh>
      </div>

      <Popup
        visible={createVisible}
        onMaskClick={() => setCreateVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>
          创建自习室
        </div>
        <Input
          placeholder="房间名称"
          value={roomName}
          onChange={setRoomName}
          style={{ marginBottom: 12 }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[2, 4, 9].map(n => (
            <Button
              key={n}
              block
              color={maxUsers === n ? 'primary' : 'default'}
              onClick={() => setMaxUsers(n)}
            >
              {n === 2 ? '二宫格' : n === 4 ? '四宫格' : '九宫格'}
            </Button>
          ))}
        </div>
        <Space block style={{ '--gap': '8px' }}>
          <Button block onClick={() => setCreateVisible(false)}>取消</Button>
          <Button block color="primary" onClick={handleCreate}>创建</Button>
        </Space>
      </Popup>
    </div>
  );
}
