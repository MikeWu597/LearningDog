import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import RoomList from './components/RoomList';
import Room from './components/Room';
import Settings from './components/Settings';
import StudyRecords from './components/StudyRecords';
import ServerConfig from './components/ServerConfig';
import { getUUID, getUsername } from './utils/uuid';
import { isServerConfigured, clearServerUrl } from './utils/server';
import { useSocket } from './hooks/useSocket';
import { lockAppOrientation, getOrientationModeByPath } from './utils/orientation';
import { ensureCameraPermission, ensurePhotoPermission } from './utils/permissions';

export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export default function App() {
  const location = useLocation();
  const [serverReady, setServerReady] = useState(isServerConfigured());
  const lastOrientationRef = useRef(null);
  const [user, setUser] = useState(() => {
    const uuid = getUUID();
    const username = getUsername();
    if (uuid && username) return { uuid, username };
    return null;
  });

  const socketHook = useSocket();

  // Request all permissions at app startup
  useEffect(() => {
    ensureCameraPermission().catch(() => {});
    ensurePhotoPermission().catch(() => {});
  }, []);

  useEffect(() => {
    const targetOrientation = getOrientationModeByPath(location.pathname);
    if (lastOrientationRef.current === targetOrientation) return;
    lastOrientationRef.current = targetOrientation;
    lockAppOrientation(targetOrientation);
  }, [location.pathname]);

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
    return <ServerConfig onConnected={handleServerConnected} />;
  }

  return (
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
  );
}
