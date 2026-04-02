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
