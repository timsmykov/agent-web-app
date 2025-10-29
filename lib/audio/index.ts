export type AudioAnalyserHandle = {
  analyser: AnalyserNode;
  context: AudioContext;
  stream: MediaStream;
  stop: () => void;
};

export type AudioMetrics = {
  amplitude: number;
  centroid: number;
};

const speechIntervals = new WeakMap<SpeechSynthesisUtterance, number>();

export async function initAudioAnalyser(): Promise<AudioAnalyserHandle> {
  if (typeof window === 'undefined') {
    throw new Error('Audio analyser can only be created in the browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const context = new AudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  return {
    analyser,
    context,
    stream,
    stop: () => {
      stream.getTracks().forEach((track) => track.stop());
      analyser.disconnect();
      source.disconnect();
      if (context.state !== 'closed') {
        context.close().catch(() => undefined);
      }
    }
  };
}

export function sampleAudioMetrics(analyser: AnalyserNode): AudioMetrics {
  const timeData = new Float32Array(analyser.fftSize);
  const freqData = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatTimeDomainData(timeData);
  let sumSquares = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    sumSquares += timeData[i] * timeData[i];
  }
  const amplitude = Math.sqrt(sumSquares / timeData.length);

  analyser.getFloatFrequencyData(freqData);
  let weightedSum = 0;
  let total = 0;
  for (let i = 0; i < freqData.length; i += 1) {
    const magnitude = (freqData[i] + 140) / 140; // normalize from -140dB..0dB
    if (magnitude > 0) {
      weightedSum += i * magnitude;
      total += magnitude;
    }
  }
  const centroid = total > 0 ? weightedSum / total / freqData.length : 0;

  return {
    amplitude: Number.isFinite(amplitude) ? amplitude : 0,
    centroid: Number.isFinite(centroid) ? centroid : 0
  };
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number) => void;
  onViseme?: (value: number) => void;
};

export function speakText(text: string, handlers: SpeakHandlers = {}) {
  if (!isSpeechSupported()) {
    throw new Error('speechSynthesis API not available in this browser.');
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onstart = () => {
    handlers.onStart?.();
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const value = 0.2 + 0.4 * Math.sin(elapsed * 3.2) + 0.3 * Math.random();
      handlers.onViseme?.(Math.min(1, Math.max(0, value)));
    }, 80);
    speechIntervals.set(utterance, interval);
  };

  utterance.onend = () => {
    handlers.onEnd?.();
    const interval = speechIntervals.get(utterance);
    if (interval) {
      window.clearInterval(interval);
      speechIntervals.delete(utterance);
    }
  };

  utterance.onboundary = (event) => {
    handlers.onBoundary?.(event.charIndex);
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function cancelSpeech() {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}
