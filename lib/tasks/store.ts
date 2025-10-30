import { runSimulatedTask } from './simulator';

export type Role = 'user' | 'agent' | 'system' | 'tool';
export type TaskStatus = 'queued' | 'running' | 'need_input' | 'succeeded' | 'failed';

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  markdown?: boolean;
  attachments?: any[];
  taskId?: string;
  data?: unknown;
  status?: 'pending' | 'sent' | 'failed';
  ts: number;
};

export type TaskEvent = {
  taskId: string;
  seq: number;
  step?: string;
  status: TaskStatus;
  message?: string;
  data?: Record<string, unknown> | null;
  progress?: number;
  ts: number;
};

export type TaskSummary = {
  taskId: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
};

type TaskRecord = TaskSummary & {
  input: string;
  history: TaskEvent[];
};

type TaskSubscriber = {
  id: string;
  send: (event: TaskEvent) => void;
};

export type TaskEventInput = Omit<TaskEvent, 'seq' | 'ts' | 'taskId'> & {
  ts?: number;
};

type CreateTaskOptions = {
  taskId?: string;
  simulate?: boolean;
  status?: TaskStatus;
  createdAt?: number;
};

class TaskStore {
  private tasks = new Map<string, TaskRecord>();
  private subscribers = new Map<string, Set<TaskSubscriber>>();
  private seqCounters = new Map<string, number>();

  createTask(input: string, options?: CreateTaskOptions): TaskSummary {
    const now = options?.createdAt ?? Date.now();
    const taskId = options?.taskId ?? crypto.randomUUID();
    if (this.tasks.has(taskId)) {
      throw new Error(`Task with id ${taskId} already exists.`);
    }
    const initialStatus = options?.status ?? 'queued';
    const record: TaskRecord = {
      taskId,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
      input,
      history: []
    };

    this.tasks.set(taskId, record);
    this.seqCounters.set(taskId, 0);

    if (options?.simulate !== false) {
      // Kick off simulator asynchronously to avoid blocking response.
      setTimeout(() => {
        runSimulatedTask(taskId, input, (event) => this.pushEvent(taskId, event));
      }, 15);
    }

    return {
      taskId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  listTasks(status?: TaskStatus): TaskSummary[] {
    const result: TaskSummary[] = [];
    for (const record of this.tasks.values()) {
      if (!status || record.status === status) {
        result.push({
          taskId: record.taskId,
          status: record.status,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        });
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  pushEvent(taskId: string, payload: TaskEventInput): TaskEvent | undefined {
    const record = this.tasks.get(taskId);
    if (!record) {
      return undefined;
    }

    const seq = (this.seqCounters.get(taskId) ?? 0) + 1;
    this.seqCounters.set(taskId, seq);

    const event: TaskEvent = {
      taskId,
      seq,
      ts: payload.ts ?? Date.now(),
      status: payload.status,
      step: payload.step,
      message: payload.message,
      data: payload.data ?? null,
      progress: payload.progress
    };

    record.history.push(event);
    record.status = payload.status;
    record.updatedAt = event.ts;

    this.tasks.set(taskId, record);
    this.emit(taskId, event);
    return event;
  }

  subscribe(taskId: string, subscriber: TaskSubscriber) {
    const pool = this.subscribers.get(taskId) ?? new Set<TaskSubscriber>();
    pool.add(subscriber);
    this.subscribers.set(taskId, pool);
  }

  unsubscribe(taskId: string, subscriberId: string) {
    const pool = this.subscribers.get(taskId);
    if (!pool) return;
    for (const sub of pool) {
      if (sub.id === subscriberId) {
        pool.delete(sub);
        break;
      }
    }
    if (pool.size === 0) {
      this.subscribers.delete(taskId);
    } else {
      this.subscribers.set(taskId, pool);
    }
  }

  private emit(taskId: string, event: TaskEvent) {
    const pool = this.subscribers.get(taskId);
    if (!pool || pool.size === 0) return;
    for (const subscriber of pool) {
      subscriber.send(event);
    }
  }
}

export const taskStore = new TaskStore();
