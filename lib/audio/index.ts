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

export function isRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

const recognitionErrorMessages: Record<string, string> = {
  'no-speech': 'No speech detected. Check your microphone and try again.',
  'audio-capture': 'Microphone not available. Check permissions or reconnect the device.',
  'not-allowed': 'Microphone access is blocked. Allow access in the browser and try again.',
  aborted: 'Listening stopped before any speech was captured.',
  network: 'Speech recognition service is unavailable right now. Please try again shortly.',
  'service-not-allowed': 'Speech recognition service is not available in this context.',
  'bad-grammar': 'Speech was captured but could not be understood.',
  'language-not-supported': 'This language is not supported by the speech recogniser.'
};

export function describeRecognitionError(code: string): string {
  return recognitionErrorMessages[code] ?? 'Speech recognition failed. Please try again.';
}
