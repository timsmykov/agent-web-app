'use client';

import { create } from 'zustand';
import type { TaskEvent, TaskStatus, TaskSummary } from '@/lib/tasks/store';
import { connectTaskStream } from '@/lib/utils/sse';
import { sendRequestToN8n } from '@/lib/n8nClient';
import { useChatStore } from './chat';

export type TaskWithHistory = TaskSummary & {
  history: TaskEvent[];
  prompt?: string;
};

type TaskFilter = TaskStatus | 'all';

type TaskState = {
  tasks: Record<string, TaskWithHistory>;
  filter: TaskFilter;
  search: string;
  subscribeToTask: (taskId: string) => Promise<void>;
  createTask: (input: string, taskId?: string) => Promise<string>;
  refreshTasks: (status?: TaskStatus) => Promise<void>;
  setFilter: (filter: TaskFilter) => void;
  setSearch: (value: string) => void;
};

const connections = new Map<string, { close: () => void }>();

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},
  filter: 'all',
  search: '',
  async subscribeToTask(taskId) {
    if (connections.has(taskId)) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (response.ok) {
        const payload: { taskId: string; status: TaskStatus; history: TaskEvent[] } =
          await response.json();
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: {
              taskId,
              status: payload.status,
              createdAt: payload.history[0]?.ts ?? Date.now(),
              updatedAt: payload.history[payload.history.length - 1]?.ts ?? Date.now(),
              history: payload.history,
              prompt: state.tasks[taskId]?.prompt
            }
          }
        }));
        payload.history.forEach((event) => {
          useChatStore.getState().ingestTaskEvent(event);
        });
      }
    } catch (error) {
      console.error('Failed to hydrate task history', error);
    }

    const baseHandle = connectTaskStream(taskId, (event) => {
      set((state) => {
        const existing = state.tasks[event.taskId] ?? {
          taskId: event.taskId,
          status: event.status,
          createdAt: event.ts,
          updatedAt: event.ts,
          history: [],
          prompt: undefined
        };

        const nextHistory = [...existing.history, event];
        const nextTask: TaskWithHistory = {
          ...existing,
          status: event.status,
          updatedAt: event.ts,
          history: nextHistory
        };

        return {
          tasks: {
            ...state.tasks,
            [event.taskId]: nextTask
          }
        };
      });

      useChatStore.getState().ingestTaskEvent(event);

      if (event.status === 'succeeded') {
        const prompt = get().tasks[event.taskId]?.prompt;
        if (prompt) {
          void (async () => {
            const result = await sendRequestToN8n(prompt);
            const { appendMessage } = useChatStore.getState();
            appendMessage({
              role: result.status === 'success' ? 'agent' : 'system',
              content: result.message,
              markdown: false,
              taskId: event.taskId,
              ts: Date.now()
            });
          })();
        }
      }

      if (event.status === 'succeeded' || event.status === 'failed') {
        useChatStore.getState().completeTaskSummary(event.taskId, event.status, event.message);
        const connection = connections.get(event.taskId);
        if (connection) {
          setTimeout(() => connection.close(), 1500);
        }
      }
    });

    const handle = {
      close: () => {
        baseHandle.close();
        connections.delete(taskId);
      }
    };

    connections.set(taskId, handle);
  },
  async createTask(input, taskId) {
    const payload: { input: string; taskId?: string } = { input };
    if (taskId) {
      payload.taskId = taskId;
    }
    const body = JSON.stringify(payload);
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? 'Failed to create task');
    }

    const { taskId: createdTaskId } = (await response.json()) as { taskId: string };

    const now = Date.now();
    set((state) => ({
      tasks: {
        ...state.tasks,
        [createdTaskId]: {
          taskId: createdTaskId,
          status: 'queued',
          createdAt: now,
          updatedAt: now,
          history: [],
          prompt: input
        }
      }
    }));

    await get().subscribeToTask(createdTaskId);
    return createdTaskId;
  },
  async refreshTasks(status) {
    const query = status ? `?status=${status}` : '';
    const response = await fetch(`/api/tasks${query}`);
    if (!response.ok) {
      console.error('Failed to fetch tasks');
      return;
    }

    const payload = (await response.json()) as { items: TaskSummary[] };
    set((state) => {
      const merged: Record<string, TaskWithHistory> = { ...state.tasks };
      payload.items.forEach((summary) => {
        const existing = merged[summary.taskId];
        merged[summary.taskId] = {
          ...summary,
          history: existing?.history ?? [],
          prompt: existing?.prompt
        };
      });
      return { tasks: merged };
    });
  },
  setFilter: (filter) => set({ filter }),
  setSearch: (value) => set({ search: value })
}));
