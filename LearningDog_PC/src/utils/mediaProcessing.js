/**
 * Apply Gaussian blur to a video stream using canvas
 */
export function createBlurredStream(stream, blurRadius = 10) {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.play();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  video.addEventListener('loadedmetadata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  });

  function drawFrame() {
    if (video.readyState >= 2) {
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }
  setInterval(drawFrame, 1000 / 8);

  return canvas.captureStream(8); // 8 fps
}

/**
 * Reduce video frame rate and resolution
 */
export function createCompressedStream(stream, maxWidth = 640, fps = 8) {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return stream;

  const settings = videoTrack.getSettings();
  const aspectRatio = settings.height / settings.width;
  const width = Math.min(settings.width, maxWidth);
  const height = Math.round(width * aspectRatio);

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.play();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  function drawFrame() {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, width, height);
    }
  }
  setInterval(drawFrame, 1000 / fps);

  const compressedStream = canvas.captureStream(fps);

  // Preserve audio tracks if any
  stream.getAudioTracks().forEach(track => {
    compressedStream.addTrack(track);
  });

  return compressedStream;
}
