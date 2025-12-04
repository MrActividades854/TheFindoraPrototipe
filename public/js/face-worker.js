// Web Worker para detección en segundo plano

let faceRec = null;
let detecting = false;

self.onmessage = async (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    // Cargar modelos en el worker
    importScripts('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
    
    faceRec = {
      modelPath: data.modelPath,
      threshold: data.threshold,
      detecting: false
    };

    await faceapi.nets.tinyFaceDetector.loadFromUri(data.modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromUri(data.modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromUri(data.modelPath);

    self.postMessage({ type: 'ready' });
  }

  if (type === 'startDetection') {
    detecting = true;
    self.postMessage({ type: 'detecting', status: 'started' });
  }

  if (type === 'stopDetection') {
    detecting = false;
    self.postMessage({ type: 'detecting', status: 'stopped' });
  }
};