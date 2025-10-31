'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, X, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { VoiceOrb, type VoiceOrbMode } from './VoiceOrb';
import { useChatStore } from '@/store/chat';
import { useTaskStore } from '@/store/tasks';
import { useToast } from '@/components/ui/toast-provider';
import { createVAD } from '@/lib/audio/vad';
import {
  initAudioAnalyser,
  sampleAudioMetrics,
  isRecognitionSupported,
  describeRecognitionError
} from '@/lib/audio/index';
import type { AudioAnalyserHandle } from '@/lib/audio/index';
import { cn } from '@/lib/utils/cn';

interface RecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

const modeCopy: Record<VoiceOrbMode, { title: string; caption: string }> = {
  idle: {
    title: 'Mic idle',
    caption: 'Tap the mic when you want to talk.'
  },
  listening: {
    title: 'Listening…',
    caption: 'Speak naturally. I’m capturing in realtime.'
  },
  thinking: {
    title: 'Processing…',
    caption: 'Working through what you just shared.'
  }
};

type ControlButtonVariant = 'default' | 'primary' | 'danger';

interface ControlButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: ControlButtonVariant;
}

function ControlButton({ icon: Icon, label, onClick, variant = 'default' }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full border border-white/10 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
        'bg-white/10 hover:bg-white/20',
        variant === 'primary' && 'border-transparent bg-[var(--accent-0)] text-black shadow-[0_0_40px_rgba(90,150,255,0.45)] hover:brightness-95',
        variant === 'danger' && 'border-danger/40 text-danger hover:bg-danger/10'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function VoiceOverlay() {
  const voiceOverlayOpen = useChatStore((state) => state.voiceOverlayOpen);
  const voiceMode = useChatStore((state) => state.voiceMode);
  const setVoiceOverlayOpen = useChatStore((state) => state.setVoiceOverlayOpen);
  const setVoiceMode = useChatStore((state) => state.setVoiceMode);
  const setGhostText = useChatStore((state) => state.setGhostText);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const setComposer = useChatStore((state) => state.setComposer);
  const setSubmitting = useChatStore((state) => state.setSubmitting);
  const setHighlightedTaskId = useChatStore((state) => state.setHighlightedTaskId);
  const { push } = useToast();
  const createTask = useTaskStore((state) => state.createTask);

  const [metrics, setMetrics] = useState({ amplitude: 0, centroid: 0 });
  const [micEnabled, setMicEnabled] = useState(false);
  const analyserRef = useRef<AudioAnalyserHandle | null>(null);
  const rafRef = useRef<number>();
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const vad = useMemo(() => createVAD({ hangoverMS: 650 }), []);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef(voiceOverlayOpen);
  const micRef = useRef(micEnabled);

  const stopCapture = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    analyserRef.current?.stop();
    analyserRef.current = null;
    vad.reset();
    setMetrics({ amplitude: 0, centroid: 0 });
  }, [vad]);

  useEffect(() => {
    overlayRef.current = voiceOverlayOpen;
    if (!voiceOverlayOpen) {
      setMicEnabled(false);
      stopCapture();
      setVoiceMode('idle');
    }
  }, [setVoiceMode, stopCapture, voiceOverlayOpen]);

  const closeOverlay = useCallback(() => {
    setVoiceOverlayOpen(false);
    setVoiceMode('idle');
    setGhostText('');
    setMicEnabled(false);
    stopCapture();
  }, [setGhostText, setVoiceMode, setVoiceOverlayOpen, stopCapture]);

  useEffect(() => {
    const escListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeOverlay();
      }
    };
    window.addEventListener('keydown', escListener);
    return () => window.removeEventListener('keydown', escListener);
  }, [closeOverlay]);

  const handleFinalTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setVoiceMode('thinking');
      appendMessage({ role: 'user', content: trimmed });
      setComposer('');
      setGhostText('');
      setVoiceOverlayOpen(false);
      setSubmitting(true);
      try {
        const taskId = await createTask(trimmed);
        setHighlightedTaskId(taskId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Voice task failed to start';
        push({ title: 'Voice capture error', description: message, variant: 'danger' });
      } finally {
        setSubmitting(false);
      }
    },
    [appendMessage, createTask, push, setComposer, setGhostText, setHighlightedTaskId, setSubmitting, setVoiceMode, setVoiceOverlayOpen]
  );

  useEffect(() => {
    micRef.current = micEnabled;
    if (!micEnabled) {
      setVoiceMode('idle');
    }
  }, [micEnabled, setVoiceMode]);

  useEffect(() => {
    if (!voiceOverlayOpen || !micEnabled) {
      stopCapture();
      return;
    }

    if (!isRecognitionSupported()) {
      const message = 'Speech recognition is not supported in this browser.';
      setError(message);
      push({ title: 'Voice not available', description: message, variant: 'warn' });
      setMicEnabled(false);
      return;
    }

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const handle = await initAudioAnalyser();
        if (cancelled) {
          handle.stop();
          return;
        }
        analyserRef.current = handle;
        const smoothing = { amp: 0, centroid: 0 };
        const analyse = () => {
          if (!analyserRef.current || !micRef.current) return;
          const { amplitude, centroid } = sampleAudioMetrics(analyserRef.current.analyser);
          smoothing.amp = smoothing.amp * 0.8 + amplitude * 0.2;
          smoothing.centroid = smoothing.centroid * 0.8 + centroid * 0.2;
          vad.update(smoothing.amp, performance.now());
          const mode = vad.getState();
          if (mode === 'speech') {
            setVoiceMode('listening');
          } else if (mode === 'silence') {
            setVoiceMode('thinking');
          }
          setMetrics({ amplitude: smoothing.amp, centroid: smoothing.centroid });
          rafRef.current = requestAnimationFrame(analyse);
        };
        analyse();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to access microphone';
        setError(message);
        push({ title: 'Microphone unavailable', description: message, variant: 'danger' });
        setMicEnabled(false);
        return;
      }

      const Recognition: RecognitionCtor =
        (window as typeof window & { webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ||
        (window as typeof window & { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            transcript += result[0].transcript;
          }
        }
        if (transcript) {
          setGhostText(transcript);
        }
        if (finalTranscript) {
          setGhostText('');
          handleFinalTranscript(finalTranscript);
        }
      };
      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'aborted') {
          const message = describeRecognitionError(event.error);
          setError(message);
          push({ title: 'Speech recognition error', description: message, variant: 'warn' });
        } else {
          setError(null);
        }
        setMicEnabled(false);
      };
      recognition.onend = () => {
        if (overlayRef.current && micRef.current && !cancelled) {
          recognition.start();
        }
      };
      recognition.start();
      recognitionRef.current = recognition;
      setVoiceMode('listening');
    })();

    return () => {
      cancelled = true;
      stopCapture();
    };
  }, [handleFinalTranscript, micEnabled, push, setGhostText, setVoiceMode, stopCapture, vad, voiceOverlayOpen]);

  const currentCopy = modeCopy[voiceMode];
  const dismissError = useCallback(() => setError(null), []);

  const toggleMic = useCallback(() => {
    setError(null);
    setMicEnabled((active) => !active);
  }, []);

  const controlButtons: Array<{
    key: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    variant?: ControlButtonVariant;
  }> = [
    {
      key: 'mic',
      icon: micEnabled ? MicOff : Mic,
      label: micEnabled ? 'Disable microphone' : 'Enable microphone',
      onClick: toggleMic,
      variant: micEnabled ? 'primary' : 'default'
    },
    { key: 'close', icon: X, label: 'Close voice session', onClick: closeOverlay, variant: 'danger' }
  ];

  if (!voiceOverlayOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#030712] via-[#04081a] to-[#010208] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,160,255,0.22),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-x-[-30%] top-[-25%] h-[55%] rounded-[50%] bg-[conic-gradient(from_140deg_at_50%_50%,rgba(120,150,255,0.3),rgba(10,15,40,0))] blur-[120px]" />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6">
        {error && (
          <div className="absolute top-12 flex items-center gap-2 rounded-full bg-danger/15 px-4 py-2 text-sm text-danger shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <button
              type="button"
              onClick={dismissError}
              className="text-xs uppercase tracking-[0.2em] text-danger/80 transition hover:text-danger"
            >
              Dismiss
            </button>
          </div>
        )}
        <span className="text-xs uppercase tracking-[0.4em] text-white/30">{currentCopy.title}</span>
        <div className="relative aspect-square w-[min(360px,72vw)] max-w-md">
          <div className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(110,160,255,0.24),rgba(0,0,0,0)_70%)] blur-[80px]" />
          <div className="absolute inset-[-8%] rounded-full border border-white/20 shadow-[0_0_120px_rgba(70,120,255,0.35)]" />
          <div className="relative h-full w-full overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(170,210,255,0.25),rgba(30,60,120,0.45)_55%,rgba(10,14,30,0.65))]">
            <VoiceOrb mode={voiceMode} amplitude={metrics.amplitude} centroid={metrics.centroid} />
            <div className="pointer-events-none absolute inset-0 rounded-full border border-white/15 mix-blend-screen" />
            <div className="pointer-events-none absolute inset-[12%] rounded-full border border-white/10" />
          </div>
        </div>
        <p className="max-w-sm text-center text-sm text-white/60">{currentCopy.caption}</p>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 pb-12">
        <div className="flex items-center gap-4 rounded-full bg-white/10 px-6 py-4 shadow-[0_0_45px_rgba(80,120,255,0.25)] backdrop-blur-xl">
          {controlButtons.map(({ key, ...button }) => (
            <ControlButton key={key} {...button} />
          ))}
        </div>
      </div>
    </div>
  );
}
