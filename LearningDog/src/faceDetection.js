const ort = require('onnxruntime-node');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_DIR = path.join(__dirname, '..', 'data', 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'version-RFB-320.onnx');
const MODEL_URL = 'https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx';

const INPUT_W = 320;
const INPUT_H = 240;
const CONFIDENCE_THRESHOLD = 0.7;

let session = null;
let initPromise = null;
let available = true;

function followRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(followRedirects(res.headers.location, maxRedirects - 1));
      } else if (res.statusCode === 200) {
        resolve(res);
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function downloadModel() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  console.log('Downloading face detection model...');
  const res = await followRedirects(MODEL_URL);

  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(MODEL_PATH);
    res.pipe(ws);
    ws.on('finish', () => {
      ws.close();
      console.log('Face detection model downloaded successfully');
      resolve();
    });
    ws.on('error', (err) => {
      fs.unlink(MODEL_PATH, () => {});
      reject(err);
    });
  });
}

async function init() {
  if (session) return true;
  if (!available) return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!fs.existsSync(MODEL_PATH)) {
        await downloadModel();
      }
      session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['cpu'],
      });
      console.log('Face detection model loaded');
      return true;
    } catch (err) {
      console.error('Face detection init failed:', err.message);
      available = false;
      return false;
    }
  })();
  return initPromise;
}

/**
 * Detect faces in a WebP/JPEG/PNG image buffer.
 * Returns array of { x, y, w, h, confidence, ratio } where ratio = max(faceW, faceH) / min(imageW, imageH)
 */
async function detectFaces(frameBuffer) {
  if (!session) return [];

  try {
    // Decode image and get original dimensions
    const image = sharp(frameBuffer);
    const metadata = await image.metadata();
    const origW = metadata.width;
    const origH = metadata.height;

    if (!origW || !origH) return [];

    // Resize to model input and get raw RGB pixels
    const { data } = await image
      .resize(INPUT_W, INPUT_H, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert NHWC uint8 to NCHW float32, normalize: (pixel - 127) / 128
    const float32 = new Float32Array(3 * INPUT_H * INPUT_W);
    for (let h = 0; h < INPUT_H; h++) {
      for (let w = 0; w < INPUT_W; w++) {
        const srcIdx = (h * INPUT_W + w) * 3;
        const dstBaseR = 0 * INPUT_H * INPUT_W;
        const dstBaseG = 1 * INPUT_H * INPUT_W;
        const dstBaseB = 2 * INPUT_H * INPUT_W;
        const pos = h * INPUT_W + w;
        float32[dstBaseR + pos] = (data[srcIdx] - 127) / 128;
        float32[dstBaseG + pos] = (data[srcIdx + 1] - 127) / 128;
        float32[dstBaseB + pos] = (data[srcIdx + 2] - 127) / 128;
      }
    }

    const inputTensor = new ort.Tensor('float32', float32, [1, 3, INPUT_H, INPUT_W]);
    const results = await session.run({ input: inputTensor });

    // UltraFace outputs: scores [1, N, 2], boxes [1, N, 4]
    const scores = results.scores.data;
    const boxes = results.boxes.data;
    const numAnchors = scores.length / 2;

    const minDim = Math.min(origW, origH);
    const faces = [];

    for (let i = 0; i < numAnchors; i++) {
      const confidence = scores[i * 2 + 1]; // face class score
      if (confidence < CONFIDENCE_THRESHOLD) continue;

      // boxes are normalized [x_min, y_min, x_max, y_max] in [0, 1]
      const xMin = boxes[i * 4];
      const yMin = boxes[i * 4 + 1];
      const xMax = boxes[i * 4 + 2];
      const yMax = boxes[i * 4 + 3];

      const faceW = (xMax - xMin) * origW;
      const faceH = (yMax - yMin) * origH;
      const maxSide = Math.max(faceW, faceH);
      const ratio = maxSide / minDim;

      faces.push({
        x: xMin, y: yMin,
        w: xMax - xMin, h: yMax - yMin,
        confidence,
        ratio,
      });
    }

    return faces;
  } catch (err) {
    // Silently fail - don't block normal operation
    return [];
  }
}

/**
 * Check if any face in the image has a side >= threshold% of the shortest image dimension.
 */
async function hasDangerousFace(frameBuffer, threshold = 0.2) {
  const faces = await detectFaces(frameBuffer);
  return faces.some(f => f.ratio >= threshold);
}

module.exports = { init, detectFaces, hasDangerousFace };
