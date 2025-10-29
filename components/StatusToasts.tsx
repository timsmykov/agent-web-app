'use client';

import { useEffect, useRef } from 'react';
import { useTaskStore } from '@/store/tasks';
import { useToast } from '@/components/ui/toast-provider';
import type { TaskStatus } from '@/lib/tasks/store';

const statusCopy: Partial<Record<TaskStatus, { title: string; description: string; variant: 'success' | 'warn' | 'danger' }>> = {
  succeeded: {
    title: 'Task completed',
    description: 'Simulation finished successfully.',
    variant: 'success'
  },
  failed: {
    title: 'Task failed',
    description: 'A simulated flow encountered an error.',
    variant: 'danger'
  },
  need_input: {
    title: 'Task needs input',
    description: 'The flow is waiting for additional details.',
    variant: 'warn'
  }
};

export function StatusToasts() {
  const tasks = useTaskStore((state) => state.tasks);
  const { push } = useToast();
  const seenRef = useRef(new Map<string, TaskStatus>());

  useEffect(() => {
    const entries = Object.values(tasks);
    entries.forEach((task) => {
      const prev = seenRef.current.get(task.taskId);
      if (prev !== task.status) {
        seenRef.current.set(task.taskId, task.status);
        const copy = statusCopy[task.status];
        if (copy) {
          push({
            title: copy.title,
            description: `${copy.description} (${task.taskId.slice(0, 6)})`,
            variant: copy.variant
          });
        }
      }
    });
  }, [push, tasks]);

  return null;
}
