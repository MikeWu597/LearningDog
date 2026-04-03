import { ScreenOrientation } from '@capacitor/screen-orientation';

export async function lockAppOrientation(mode) {
  const orientationValue = mode === 'landscape' ? 'landscape-primary' : 'portrait-primary';
  try {
    await ScreenOrientation.lock({ orientation: orientationValue });
  } catch (e) {
    console.warn('ScreenOrientation lock failed:', e);
  }
}

export function getOrientationModeByPath(pathname) {
  return pathname.startsWith('/room/') ? 'landscape' : 'portrait';
}
