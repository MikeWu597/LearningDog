import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

const PhotoLibrary = registerPlugin('PhotoLibrary');

function isNativeIos() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function downloadImage(dataUrl, fileName) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

export async function ensureNativeCameraPermission() {
  if (!isNativeIos()) {
    return;
  }

  const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
  if (permissions.camera !== 'granted') {
    throw new Error('请在系统设置中允许使用摄像头');
  }
}

export async function savePosterImage(dataUrl, fileName) {
  if (!isNativeIos()) {
    downloadImage(dataUrl, fileName);
    return 'download';
  }

  await PhotoLibrary.saveImage({ dataUrl, fileName });
  return 'photo-library';
}