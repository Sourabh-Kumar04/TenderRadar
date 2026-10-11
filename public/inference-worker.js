importScripts('/onnx/ort.min.js');

let inferenceSession = null;
let labels = [];

self.onmessage = async function(e) {
  const { type, payload } = e.data;
  if (type === 'LOAD_MODEL') {
    try {
      if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
        ort.env.wasm.wasmPaths = '/onnx/';
        ort.env.wasm.numThreads = 1;
      }
      inferenceSession = await ort.InferenceSession.create(payload.modelBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      labels = payload.labels || [];
      self.postMessage({ type: 'MODEL_READY' });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err && err.message ? err.message : String(err),
      });
    }
  } else if (type === 'PROCESS_AUDIO') {
    if (inferenceSession === null) {
      self.postMessage({
        type: 'ERROR',
        error: 'Model not loaded. Send LOAD_MODEL first',
      });
      return;
    }
    try {
      // payload.chunk: Float32Array of 144000 samples (3s at 48kHz)
      const inputChunk = payload.chunk instanceof Float32Array
        ? payload.chunk
        : new Float32Array(payload.chunk);

      // Pad or slice to exactly 144000 samples
      let finalSamples = inputChunk;
      if (inputChunk.length !== 144000) {
        finalSamples = new Float32Array(144000);
        finalSamples.set(inputChunk.subarray(0, Math.min(inputChunk.length, 144000)));
      }

      const tensor = new ort.Tensor('float32', finalSamples, [1, 144000]);
      const feeds = {};
      const inputName = inferenceSession.inputNames[0] || 'input';
      feeds[inputName] = tensor;

      const results = await inferenceSession.run(feeds);
      const outputName = inferenceSession.outputNames[0] || 'output';
      const logits = results[outputName].data;

      // Applying sigmoid: 1 / (1 + exp(-logits))
      const confidences = new Float32Array(logits.length);
      for (let i = 0; i < logits.length; i++) {
        confidences[i] = 1 / (1 + Math.exp(-logits[i]));
      }

      self.postMessage({
        type: 'CHUNK_RESULT',
        chunkIndex: payload.chunkIndex ?? 0,
        confidences: confidences,
        labels: labels,
      });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err && err.message ? err.message : String(err),
      });
    }
  }
};
