export type VADMode = 'idle' | 'speech' | 'silence';

export interface VADOptions {
  startThreshold: number;
  stopThreshold: number;
  hangoverMS: number;
  sampleInterval: number;
}

const defaultOptions: VADOptions = {
  startThreshold: 0.04,
  stopThreshold: 0.02,
  hangoverMS: 750,
  sampleInterval: 50
};

export type VADListener = (state: VADMode) => void;

export class VoiceActivityDetector {
  private options: VADOptions;
  private mode: VADMode = 'idle';
  private lastActive = 0;
  private listeners = new Set<VADListener>();

  constructor(options?: Partial<VADOptions>) {
    this.options = { ...defaultOptions, ...options };
  }

  onChange(listener: VADListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(rms: number, timestamp = performance.now()) {
    if (Number.isNaN(rms)) return;

    if (rms >= this.options.startThreshold) {
      this.lastActive = timestamp;
      if (this.mode !== 'speech') {
        this.mode = 'speech';
        this.emit();
      }
      return;
    }

    if (this.mode === 'speech' && rms <= this.options.stopThreshold) {
      if (timestamp - this.lastActive >= this.options.hangoverMS) {
        this.mode = 'silence';
        this.emit();
      }
    } else if (this.mode === 'silence' && rms >= this.options.stopThreshold * 0.75) {
      this.mode = 'speech';
      this.lastActive = timestamp;
      this.emit();
    }
  }

  reset() {
    this.mode = 'idle';
    this.lastActive = 0;
    this.emit();
  }

  getState(): VADMode {
    return this.mode;
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.mode);
    }
  }
}

export function createVAD(options?: Partial<VADOptions>) {
  return new VoiceActivityDetector(options);
}
