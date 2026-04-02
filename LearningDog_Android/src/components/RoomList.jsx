import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, List, Button, Dialog, Input, Picker, Toast, Tag, Space, PullToRefresh } from 'antd-mobile';
import { apiGetRooms, apiCreateRoom, apiJoinRoom } from '../utils/api';
import { useApp } from '../App';

export default function RoomList() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxUsers, setMaxUsers] = useState(4);

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

  const handleCreate = async () => {
    const result = await Dialog.confirm({
      title: '创建自习室',
      content: (
        <div style={{ padding: '12px 0' }}>
          <Input
            placeholder="房间名称"
            value={roomName}
            onChange={setRoomName}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {[2, 4, 9].map(n => (
              <Button
                key={n}
                size="small"
                color={maxUsers === n ? 'primary' : 'default'}
                onClick={() => setMaxUsers(n)}
              >
                {n === 2 ? '二宫格' : n === 4 ? '四宫格' : '九宫格'}
              </Button>
            ))}
          </div>
        </div>
      ),
    });

    if (result && roomName.trim()) {
      try {
        await apiCreateRoom(roomName.trim(), maxUsers);
        Toast.show({ content: '房间创建成功' });
        setRoomName('');
        fetchRooms();
      } catch (err) {
        Toast.show({ content: '创建失败' });
      }
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
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
        <Button size="small" color="primary" onClick={handleCreate}>+ 创建房间</Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
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
    </div>
  );
}
