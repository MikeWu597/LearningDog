let wakeLock = null;

export function getKeepAwake() {
  return localStorage.getItem('keepAwake') === 'true';
}

export function setKeepAwake(value) {
  localStorage.setItem('keepAwake', value ? 'true' : 'false');
}

export async function requestKeepAwake() {
  if (wakeLock) return;
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}

export function releaseKeepAwake() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
