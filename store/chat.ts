'use client';

import { create } from 'zustand';
import type { ChatMessage, TaskEvent, TaskStatus } from '@/lib/tasks/store';

export type VoiceMode = 'idle' | 'listening' | 'thinking';

export interface ChatState {
  messages: ChatMessage[];
  composer: string;
  ghostText: string;
  voiceOverlayOpen: boolean;
  voiceMode: VoiceMode;
  highlightedTaskId?: string;
  isSubmitting: boolean;
  initialized: boolean;
  sessionId: string;
  setComposer: (value: string) => void;
  appendMessage: (message: Omit<ChatMessage, 'id' | 'ts'> & { id?: string; ts?: number }) => void;
  setGhostText: (value: string) => void;
  setVoiceOverlayOpen: (open: boolean) => void;
  setVoiceMode: (mode: VoiceMode) => void;
  setHighlightedTaskId: (taskId?: string) => void;
  setSubmitting: (value: boolean) => void;
  ensureWelcome: () => void;
  ingestTaskEvent: (event: TaskEvent) => void;
  completeTaskSummary: (taskId: string, status: TaskStatus, message?: string, prompt?: string) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
}

const welcomeMessage = `Welcome to Aurora Agent. Try commands like /plan, /summarize, or /run-flow. Tap the mic to speak.`;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  composer: '',
  ghostText: '',
  voiceOverlayOpen: false,
  voiceMode: 'idle',
  highlightedTaskId: undefined,
  isSubmitting: false,
  initialized: false,
  sessionId: crypto.randomUUID(),
  setComposer: (value) => set({ composer: value }),
  appendMessage: (message) => {
    const id = message.id ?? crypto.randomUUID();
    const ts = message.ts ?? Date.now();
    set((state) => ({ messages: [...state.messages, { ...message, id, ts }] }));
  },
  setGhostText: (value) => set({ ghostText: value }),
  setVoiceOverlayOpen: (open) =>
    set(() => ({ voiceOverlayOpen: open, voiceMode: 'idle' })),
  setVoiceMode: (mode) => set({ voiceMode: mode }),
  setHighlightedTaskId: (taskId) => set({ highlightedTaskId: taskId }),
  setSubmitting: (value) => set({ isSubmitting: value }),
  ensureWelcome: () => {
    if (get().initialized) return;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: welcomeMessage,
          ts: Date.now()
        }
      ],
      initialized: true
    }));
  },
  ingestTaskEvent: (event) => {
    const existingIndex = get().messages.findIndex((msg) => msg.taskId === event.taskId && msg.role === 'tool' && msg.id.endsWith(`::${event.seq}`));
    if (existingIndex >= 0) {
      return;
    }
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${event.taskId}::${event.seq}`,
          role: 'tool',
          content: event.message ?? event.step ?? 'Task update',
          markdown: false,
          taskId: event.taskId,
          ts: event.ts,
          data: event
        }
      ]
    }));
  },
  completeTaskSummary: (taskId, status, message, prompt) => {
    const summary =
      message ??
      (status === 'succeeded'
        ? 'Task completed successfully.'
        : 'Task ended with issues.');
    const content = prompt ? `${summary}\n\n*Original request:* ${prompt}` : summary;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${taskId}::final`,
          role: status === 'succeeded' ? 'agent' : 'system',
          content,
          taskId,
          ts: Date.now()
        }
      ]
    }));
  },
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg))
    }))
}));
