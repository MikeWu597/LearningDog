import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, List, Input, Button, Toast, Switch } from 'antd-mobile';
import { getUUID, setUUID, getUsername, setUsername } from '../utils/uuid';
import { apiLogin } from '../utils/api';
import { useApp } from '../App';
import { getKeepAwake, setKeepAwake } from '../utils/keepAwake';

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [uuid, setUuidInput] = useState(getUUID() || '');
  const [username, setUsernameInput] = useState(getUsername() || '');
  const [loading, setLoading] = useState(false);
  const [keepAwake, setKeepAwakeState] = useState(getKeepAwake());

  const handleSave = async () => {
    if (!username.trim()) {
      Toast.show({ content: '用户名不能为空' });
      return;
    }
    setLoading(true);
    try {
      setUUID(uuid.trim());
      setUsername(username.trim());
      await apiLogin(uuid.trim(), username.trim());
      setUser({ uuid: uuid.trim(), username: username.trim() });
      Toast.show({ content: '设置已保存' });
    } catch (err) {
      Toast.show({ content: '保存失败' });
    } finally {
      setLoading(false);
    }
  };

  const copyUUID = () => {
    navigator.clipboard.writeText(uuid).then(() => {
      Toast.show({ content: 'UUID已复制' });
    }).catch(() => {
      Toast.show({ content: '复制失败，请手动复制' });
    });
  };

  return (
    <div className="mobile-screen mobile-screen-light">
      <NavBar onBack={() => navigate('/rooms')}>用户设置</NavBar>

      <div className="mobile-main" style={{ padding: 16, overflow: 'auto' }}>
        <List header="账户信息">
          <List.Item title="UUID (身份标识)" description="重装应用后输入此UUID可恢复账户">
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Input value={uuid} onChange={setUuidInput} style={{ flex: 1 }} />
              <Button size="small" onClick={copyUUID}>复制</Button>
            </div>
          </List.Item>
          <List.Item title="用户名">
            <Input value={username} onChange={setUsernameInput} style={{ marginTop: 8 }} />
          </List.Item>
        </List>

        <List header="自习室设置" style={{ marginTop: 16 }}>
          <List.Item
            title="自习室内保持亮屏"
            description="进入自习室后防止屏幕自动熄灭"
            extra={<Switch checked={keepAwake} onChange={(v) => { setKeepAwakeState(v); setKeepAwake(v); }} />}
          />
        </List>

        <Button
          block
          color="primary"
          onClick={handleSave}
          loading={loading}
          style={{ marginTop: 16 }}
        >
          保存设置
        </Button>
      </div>
    </div>
  );
}
