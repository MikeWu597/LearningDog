const SERVER_URL = 'http://localhost:3000';

export async function apiLogin(uuid, username) {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, username }),
  });
  return res.json();
}

export async function apiGetUser(uuid) {
  const res = await fetch(`${SERVER_URL}/api/auth/user/${uuid}`);
  return res.json();
}

export async function apiGetRooms() {
  const res = await fetch(`${SERVER_URL}/api/rooms`);
  return res.json();
}

export async function apiCreateRoom(name, maxUsers) {
  const res = await fetch(`${SERVER_URL}/api/rooms/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, maxUsers }),
  });
  return res.json();
}

export async function apiJoinRoom(roomId, uuid) {
  const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  });
  return res.json();
}

export async function apiLeaveRoom(roomId, uuid) {
  const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  });
  return res.json();
}

export async function apiGetRoom(roomId) {
  const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}`);
  return res.json();
}

export async function apiStartFocus(uuid, roomId) {
  const res = await fetch(`${SERVER_URL}/api/records/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, roomId }),
  });
  return res.json();
}

export async function apiStopFocus(uuid) {
  const res = await fetch(`${SERVER_URL}/api/records/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  });
  return res.json();
}

export async function apiGetRecords(uuid) {
  const res = await fetch(`${SERVER_URL}/api/records/${uuid}`);
  return res.json();
}

export async function apiGetDailyRecords(uuid) {
  const res = await fetch(`${SERVER_URL}/api/records/${uuid}/daily`);
  return res.json();
}

export async function apiGetStats(uuid) {
  const res = await fetch(`${SERVER_URL}/api/records/${uuid}/stats`);
  return res.json();
}
