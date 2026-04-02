import React, { useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from './components/Login';
import RoomList from './components/RoomList';
import Room from './components/Room';
import Settings from './components/Settings';
import StudyRecords from './components/StudyRecords';
import ServerConfig from './components/ServerConfig';
import { getUUID, getUsername } from './utils/uuid';
import { isServerConfigured, clearServerUrl } from './utils/server';
import { useSocket } from './hooks/useSocket';

export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export default function App() {
  const [serverReady, setServerReady] = useState(isServerConfigured());
  const [user, setUser] = useState(() => {
    const uuid = getUUID();
    const username = getUsername();
    if (uuid && username) return { uuid, username };
    return null;
  });

  const socketHook = useSocket();

  const handleDisconnectServer = () => {
    clearServerUrl();
    socketHook.disconnect();
    setUser(null);
    setServerReady(false);
  };

  const handleServerConnected = () => {
    setServerReady(true);
    socketHook.connect();
  };

  if (!serverReady) {
    return (
      <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
        <ServerConfig onConnected={handleServerConnected} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
      <AppContext.Provider value={{ user, setUser, ...socketHook, disconnectServer: handleDisconnectServer }}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/rooms" /> : <Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/rooms" element={user ? <RoomList /> : <Navigate to="/" />} />
          <Route path="/room/:roomId" element={user ? <Room /> : <Navigate to="/" />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" />} />
          <Route path="/records" element={user ? <StudyRecords /> : <Navigate to="/" />} />
        </Routes>
      </AppContext.Provider>
    </ConfigProvider>
  );
}
