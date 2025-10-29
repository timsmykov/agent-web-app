import type { TaskEvent } from '@/lib/tasks/store';

type EventCallback = (event: TaskEvent) => void;

type SSEHandle = {
  close: () => void;
};

export function connectTaskStream(taskId: string, onEvent: EventCallback): SSEHandle {
  const url = `/api/tasks/stream?taskId=${encodeURIComponent(taskId)}`;
  const source = new EventSource(url, { withCredentials: false });

  source.onmessage = (event) => {
    if (!event.data) return;
    try {
      const payload: TaskEvent = JSON.parse(event.data);
      onEvent(payload);
    } catch (error) {
      console.error('Failed to parse task event', error);
    }
  };

  source.onerror = (error) => {
    console.error('SSE connection error', error);
  };

  return {
    close: () => {
      source.close();
    }
  };
}
