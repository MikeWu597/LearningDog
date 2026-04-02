import { v4 as uuidv4 } from 'react';

const STORAGE_KEY = 'learningdog_uuid';
const USERNAME_KEY = 'learningdog_username';

export function getOrCreateUUID() {
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
}

export function setUUID(uuid) {
  localStorage.setItem(STORAGE_KEY, uuid);
}

export function getUUID() {
  return localStorage.getItem(STORAGE_KEY);
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || '';
}

export function setUsername(name) {
  localStorage.setItem(USERNAME_KEY, name);
}
