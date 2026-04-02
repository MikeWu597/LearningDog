import React, { useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import RoomList from './components/RoomList';
import Room from './components/Room';
import Settings from './components/Settings';
import StudyRecords from './components/StudyRecords';
import { getUUID, getUsername } from './utils/uuid';
import { useSocket } from './hooks/useSocket';

export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export default function App() {
  const [user, setUser] = useState(() => {
    const uuid = getUUID();
    const username = getUsername();
    if (uuid && username) return { uuid, username };
    return null;
  });

  const { socket, connected, emit, on, off } = useSocket();

  return (
    <AppContext.Provider value={{ user, setUser, socket, connected, emit, on, off }}>
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
