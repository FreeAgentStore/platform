/**
 * Whisper STT Web Worker
 * Loads whisper-small via Transformers.js, transcribes audio to text.
 */

let pipeline = null;

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'init') {
    try {
      self.postMessage({ type: 'progress', pct: 0 });
      const { pipeline: createPipeline } = await import(
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm'
      );
      self.postMessage({ type: 'progress', pct: 30 });
      pipeline = await createPipeline('automatic-speech-recognition', 'onnx-community/whisper-small', {
        dtype: 'q8',
        device: typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm',
      });
      self.postMessage({ type: 'progress', pct: 100 });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: err?.message || String(err) });
    }
    return;
  }

  if (type === 'transcribe') {
    const { id, audio } = e.data;
    if (!pipeline) {
      self.postMessage({ type: 'error', id, error: 'Model not loaded' });
      return;
    }
    try {
      const result = await pipeline(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
      self.postMessage({ type: 'result', id, text: result.text, chunks: result.chunks });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err?.message || String(err) });
    }
  }
};
