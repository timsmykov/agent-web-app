'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Video, Mic, MoreHorizontal, X, AlertCircle } from 'lucide-react';
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
  isSpeechSupported,
  speakText
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
    title: 'Voice ready',
    caption: 'Tap when you want to speak.'
  },
  listening: {
    title: 'Listening…',
    caption: 'Speak naturally. I’m capturing in realtime.'
  },
  thinking: {
    title: 'Thinking…',
    caption: 'Processing your prompt and orchestrating tools.'
  },
  speaking: {
    title: 'Speaking…',
    caption: 'Narrating the latest summary.'
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
        'bg-white/5 hover:bg-white/10',
        variant === 'primary' && 'bg-white text-black hover:bg-white/90',
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
  const pendingSpeech = useChatStore((state) => state.pendingSpeech);
  const clearSpeech = useChatStore((state) => state.clearSpeech);
  const subtitles = useChatStore((state) => state.subtitles);
  const { push } = useToast();
  const createTask = useTaskStore((state) => state.createTask);

  const [metrics, setMetrics] = useState({ amplitude: 0, centroid: 0 });
  const analyserRef = useRef<AudioAnalyserHandle | null>(null);
  const rafRef = useRef<number>();
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const vad = useMemo(() => createVAD({ hangoverMS: 650 }), []);
  const [error, setError] = useState<string | null>(null);
  const ttsAmplitude = useRef(0);
  const overlayRef = useRef(voiceOverlayOpen);

  useEffect(() => {
    overlayRef.current = voiceOverlayOpen;
  }, [voiceOverlayOpen]);

  const closeOverlay = useCallback(() => {
    setVoiceOverlayOpen(false);
    setVoiceMode('idle');
    setGhostText('');
    recognitionRef.current?.abort();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    analyserRef.current?.stop();
    analyserRef.current = null;
  }, [setGhostText, setVoiceMode, setVoiceOverlayOpen]);

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
    if (!voiceOverlayOpen) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      analyserRef.current?.stop();
      analyserRef.current = null;
      setVoiceMode('idle');
      setMetrics({ amplitude: 0, centroid: 0 });
      return () => undefined;
    }

    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const handle = await initAudioAnalyser();
        if (cancelled) {
          handle.stop();
          return;
        }
        analyserRef.current = handle;
        const smoothing = { amp: 0, centroid: 0 };
        const analyse = () => {
          if (!analyserRef.current) return;
          const { amplitude, centroid } = sampleAudioMetrics(analyserRef.current.analyser);
          smoothing.amp = smoothing.amp * 0.85 + amplitude * 0.15;
          smoothing.centroid = smoothing.centroid * 0.85 + centroid * 0.15;
          vad.update(smoothing.amp, performance.now());
          const mode = vad.getState();
          if (mode === 'speech' && voiceMode !== 'speaking') {
            setVoiceMode('listening');
          }
          if (mode === 'silence' && voiceMode === 'listening') {
            setVoiceMode('thinking');
          }
          const drivenAmplitude = Math.max(smoothing.amp, ttsAmplitude.current);
          setMetrics({ amplitude: drivenAmplitude, centroid: smoothing.centroid });
          rafRef.current = requestAnimationFrame(analyse);
        };
        analyse();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to access microphone';
        setError(message);
        push({ title: 'Microphone unavailable', description: message, variant: 'danger' });
        return;
      }

      if (!isRecognitionSupported()) {
        const message = 'Speech recognition is not supported in this browser.';
        setError(message);
        push({ title: 'Voice not available', description: message, variant: 'warn' });
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
        push({ title: 'Speech recognition error', description: event.error, variant: 'warn' });
      };
      recognition.onend = () => {
        if (overlayRef.current) {
          recognition.start();
        }
      };
      recognition.start();
      recognitionRef.current = recognition;
      setVoiceMode('listening');
    })();

    return () => {
      cancelled = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      analyserRef.current?.stop();
      analyserRef.current = null;
      vad.reset();
    };
  }, [handleFinalTranscript, push, setGhostText, setVoiceMode, vad, voiceMode, voiceOverlayOpen]);

  useEffect(() => {
    if (!pendingSpeech) return;
    if (!isSpeechSupported()) {
      push({
        title: 'Text-to-speech unavailable',
        description: 'Your browser cannot synthesize speech.',
        variant: 'warn'
      });
      clearSpeech();
      return;
    }

    const utterance = speakText(pendingSpeech, {
      onStart: () => {
        setVoiceMode('speaking');
      },
      onEnd: () => {
        ttsAmplitude.current = 0;
        setVoiceMode(voiceOverlayOpen ? 'listening' : 'idle');
        clearSpeech();
      },
      onViseme: (value) => {
        ttsAmplitude.current = value;
      }
    });

    return () => {
      utterance.onend = null;
      utterance.onstart = null;
    };
  }, [clearSpeech, pendingSpeech, push, setVoiceMode, voiceOverlayOpen]);

  const currentCopy = modeCopy[voiceMode];
  const dismissError = useCallback(() => setError(null), []);

  const handleVideoTap = useCallback(() => {
    push({
      title: 'Video mode',
      description: 'Camera streaming is not available yet.',
      variant: 'warn'
    });
  }, [push]);

  const handleMicTap = useCallback(() => {
    push({
      title: voiceMode === 'listening' ? 'Listening' : 'Voice mode',
      description:
        voiceMode === 'listening'
          ? 'I am actively listening to your voice input.'
          : 'Voice session is running in the background.',
      variant: 'default'
    });
  }, [push, voiceMode]);

  const handleMoreTap = useCallback(() => {
    push({
      title: 'Voice tools',
      description: 'Additional controls will appear here soon.',
      variant: 'default'
    });
  }, [push]);

  const controlButtons: Array<{
    key: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    variant?: ControlButtonVariant;
  }> = [
    { key: 'video', icon: Video, label: 'Enable camera', onClick: handleVideoTap },
    { key: 'mic', icon: Mic, label: 'Voice capture status', onClick: handleMicTap, variant: 'primary' },
    { key: 'more', icon: MoreHorizontal, label: 'More options', onClick: handleMoreTap },
    { key: 'close', icon: X, label: 'Close voice session', onClick: closeOverlay, variant: 'danger' }
  ];

  if (!voiceOverlayOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(88,140,255,0.35),rgba(0,0,0,0)_65%)]" />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6">
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
        <div className="relative w-[min(320px,70vw)] max-w-sm aspect-square">
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-sky-200/25 via-sky-400/10 to-sky-900/20 blur-3xl" />
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <VoiceOrb mode={voiceMode} amplitude={metrics.amplitude} centroid={metrics.centroid} />
          </div>
        </div>
        <p className="max-w-sm text-center text-sm text-white/60">{currentCopy.caption}</p>
        {subtitles && (
          <div className="rounded-full bg-white/5 px-6 py-2 text-sm text-white/90 shadow-lg backdrop-blur">
            {subtitles}
          </div>
        )}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 pb-12">
        <div className="flex items-center gap-4 rounded-full bg-white/5 px-6 py-4 shadow-2xl backdrop-blur-lg">
          {controlButtons.map(({ key, ...button }) => (
            <ControlButton key={key} {...button} />
          ))}
        </div>
      </div>
    </div>
  );
}
