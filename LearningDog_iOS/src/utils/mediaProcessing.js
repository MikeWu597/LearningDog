/**
 * Apply Gaussian blur to a video stream using canvas
 */
export function createBlurredStream(stream, blurRadius = 8, maxWidth = 480, fps = 12) {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return stream;

  const settings = videoTrack.getSettings();
  const aspectRatio = (settings.height || 480) / (settings.width || 640);
  const width = Math.min(settings.width || 640, maxWidth);
  const height = Math.round(width * aspectRatio);

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.play();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Use a small offscreen canvas for downscale+upscale blur (ctx.filter not supported in mobile WebViews)
  const scale = Math.max(0.02, 0.12 - blurRadius * 0.01);
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = Math.max(1, Math.floor(width * scale));
  smallCanvas.height = Math.max(1, Math.floor(height * scale));
  const smallCtx = smallCanvas.getContext('2d');

  function drawFrame() {
    if (video.readyState >= 2) {
      smallCtx.drawImage(video, 0, 0, smallCanvas.width, smallCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(smallCanvas, 0, 0, width, height);
    }
    requestAnimationFrame(drawFrame);
  }
  drawFrame();

  const blurredStream = canvas.captureStream(fps);
  stream.getAudioTracks().forEach(track => {
    blurredStream.addTrack(track);
  });

  return blurredStream;
}

/**
 * Reduce video frame rate and resolution for mobile
 */
export function createCompressedStream(stream, maxWidth = 480, fps = 12) {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return stream;

  const settings = videoTrack.getSettings();
  const aspectRatio = (settings.height || 480) / (settings.width || 640);
  const width = Math.min(settings.width || 640, maxWidth);
  const height = Math.round(width * aspectRatio);

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.play();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  function drawFrame() {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, width, height);
    }
    requestAnimationFrame(drawFrame);
  }
  drawFrame();

  const compressedStream = canvas.captureStream(fps);
  stream.getAudioTracks().forEach(track => {
    compressedStream.addTrack(track);
  });

  return compressedStream;
}
