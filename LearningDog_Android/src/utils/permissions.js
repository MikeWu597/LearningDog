import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

export async function ensureCameraPermission() {
  if (!Capacitor.isNativePlatform()) return;

  const status = await Camera.checkPermissions();
  if (status.camera === 'granted') return;

  const result = await Camera.requestPermissions({ permissions: ['camera'] });
  if (result.camera !== 'granted') {
    throw new Error('请在系统设置中允许使用摄像头');
  }
}

export async function ensurePhotoPermission() {
  if (!Capacitor.isNativePlatform()) return;

  const status = await Camera.checkPermissions();
  if (status.photos === 'granted' || status.photos === 'limited') return;

  const result = await Camera.requestPermissions({ permissions: ['photos'] });
  if (result.photos !== 'granted' && result.photos !== 'limited') {
    throw new Error('请在系统设置中允许访问相册');
  }
}
