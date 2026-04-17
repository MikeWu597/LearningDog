import { getServerUrl } from './server';

function serverUrl() { return getServerUrl(); }

export async function apiLogin(uuid, username) {
  const res = await fetch(`${serverUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, username }),
  });
  return res.json();
}

export async function apiGetUser(uuid) {
  const res = await fetch(`${serverUrl()}/api/auth/user/${uuid}`);
  return res.json();
}

export async function apiGetRooms() {
  const res = await fetch(`${serverUrl()}/api/rooms`);
  return res.json();
}

export async function apiCreateRoom(name, maxUsers) {
  const res = await fetch(`${serverUrl()}/api/rooms/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, maxUsers }),
  });
  return res.json();
}

export async function apiJoinRoom(roomId, uuid) {
  const res = await fetch(`${serverUrl()}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  });
  return res.json();
}

export async function apiLeaveRoom(roomId, uuid) {
  const res = await fetch(`${serverUrl()}/api/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  });
  return res.json();
}

export async function apiGetRoom(roomId) {
  const res = await fetch(`${serverUrl()}/api/rooms/${roomId}`);
  return res.json();
}


export async function apiGetRecords(uuid) {
  const res = await fetch(`${serverUrl()}/api/records/${uuid}`);
  return res.json();
}

export async function apiGetDailyRecords(uuid) {
  const res = await fetch(`${serverUrl()}/api/records/${uuid}/daily`);
  return res.json();
}

export async function apiGetStats(uuid) {
  const res = await fetch(`${serverUrl()}/api/records/${uuid}/stats`);
  return res.json();
}

// File management
export async function apiUploadFile(uuid, file) {
  const formData = new FormData();
  formData.append('uuid', uuid);
  formData.append('file', file);
  const res = await fetch(`${serverUrl()}/api/files/upload`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function apiGetFiles(uuid) {
  const res = await fetch(`${serverUrl()}/api/files/list/${uuid}`);
  return res.json();
}

export async function apiDeleteFile(fileId, uuid) {
  const res = await fetch(`${serverUrl()}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  });
  return res.json();
}

export function getFileDownloadUrl(fileId, inline = false) {
  return `${serverUrl()}/api/files/download/${fileId}${inline ? '?inline=1' : ''}`;
}

export async function apiGetFileInfo(fileId) {
  const res = await fetch(`${serverUrl()}/api/files/info/${fileId}`);
  return res.json();
}
