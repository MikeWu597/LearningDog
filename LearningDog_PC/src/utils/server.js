const SERVER_KEY = 'learningdog_server_url';

export function getServerUrl() {
  return localStorage.getItem(SERVER_KEY) || '';
}

export function setServerUrl(url) {
  let normalized = url.trim().replace(/\/+$/, '');
  if (normalized && !normalized.startsWith('http')) {
    normalized = 'http://' + normalized;
  }
  localStorage.setItem(SERVER_KEY, normalized);
  return normalized;
}

export function clearServerUrl() {
  localStorage.removeItem(SERVER_KEY);
}

export function isServerConfigured() {
  return !!getServerUrl();
}

export async function pingServer(url) {
  let normalized = url.trim().replace(/\/+$/, '');
  if (normalized && !normalized.startsWith('http')) {
    normalized = 'http://' + normalized;
  }
  const start = performance.now();
  const res = await fetch(`${normalized}/api/auth/ping`, { method: 'GET', signal: AbortSignal.timeout(5000) });
  const latency = Math.round(performance.now() - start);
  if (!res.ok) throw new Error('服务器响应异常');
  return latency;
}
