'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleDashed, CheckCircle2, XCircle, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';
import { useTaskStore } from '@/store/tasks';
import { useChatStore } from '@/store/chat';
import type { TaskStatus } from '@/lib/tasks/store';

const statusMeta: Record<
  TaskStatus,
  {
    label: string;
    icon: React.ReactNode;
    tone: 'default' | 'success' | 'warn' | 'danger';
  }
> = {
  queued: { label: 'Queued', icon: <PauseCircle className="h-4 w-4" />, tone: 'default' },
  running: { label: 'Running', icon: <CircleDashed className="h-4 w-4 animate-spin" />, tone: 'default' },
  need_input: { label: 'Need input', icon: <PauseCircle className="h-4 w-4" />, tone: 'warn' },
  succeeded: { label: 'Succeeded', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'success' },
  failed: { label: 'Failed', icon: <XCircle className="h-4 w-4" />, tone: 'danger' }
};

const filters: (TaskStatus | 'all')[] = ['all', 'queued', 'running', 'need_input', 'succeeded', 'failed'];

export function TaskDrawer() {
  const [open, setOpen] = useState(false);
  const filter = useTaskStore((state) => state.filter);
  const setFilter = useTaskStore((state) => state.setFilter);
  const search = useTaskStore((state) => state.search);
  const setSearch = useTaskStore((state) => state.setSearch);
  const refreshTasks = useTaskStore((state) => state.refreshTasks);
  const tasks = useTaskStore((state) => state.tasks);
  const setHighlightedTaskId = useChatStore((state) => state.setHighlightedTaskId);
  const subscribeToTask = useTaskStore((state) => state.subscribeToTask);
  const highlightedTaskId = useChatStore((state) => state.highlightedTaskId);

  useEffect(() => {
    if (open) {
      refreshTasks();
    }
  }, [open, refreshTasks]);

  const items = useMemo(() => {
    const values = Object.values(tasks).sort((a, b) => b.updatedAt - a.updatedAt);
    const filtered = filter === 'all' ? values : values.filter((task) => task.status === filter);
    if (!search) return filtered;
    const query = search.toLowerCase();
    return filtered.filter((task) => task.taskId.toLowerCase().includes(query));
  }, [filter, tasks, search]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="border-white/10 bg-white/5 text-sm text-white/80">
          Task Drawer
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-gradient text-xl">Task control center</SheetTitle>
          <SheetDescription>Inspect, filter, and jump into simulated flows.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={filter === item ? 'default' : 'ghost'}
                className="rounded-full border border-white/10 px-3 text-xs"
                onClick={() => setFilter(item)}
              >
                {item === 'all' ? 'All' : statusMeta[item].label}
              </Button>
            ))}
          </div>
          <Input
            value={search}
            placeholder="Search by Task ID"
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 bg-black/40"
          />
          <Separator className="my-4" />
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-3">
              {items.map((task) => {
                const meta = statusMeta[task.status];
                const isHighlighted = highlightedTaskId === task.taskId;
                return (
                  <button
                    type="button"
                    key={task.taskId}
                    onClick={() => {
                      setHighlightedTaskId(task.taskId);
                      subscribeToTask(task.taskId);
                    }}
                    className={cn(
                      'w-full rounded-[var(--radius)] border border-white/10 bg-black/40 p-4 text-left transition hover:border-[var(--accent-0)] hover:bg-[var(--accent-0)]/10',
                      isHighlighted && 'border-[var(--accent-0)] bg-[var(--accent-0)]/10 shadow-glow'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn('text-xs uppercase tracking-[0.28em] text-white/50', isHighlighted && 'text-[var(--accent-0)]')}>
                        {task.taskId.slice(0, 8)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.tone}>{meta.label}</Badge>
                        {isHighlighted && <Badge variant="default">Selected</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/90">
                      Last update ·{' '}
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                      {meta.icon}
                      <span>{task.history.at(-1)?.message ?? 'Awaiting updates'}</span>
                    </div>
                    {isHighlighted && (
                      <div className="mt-3 text-xs text-[var(--accent-0)]">View updates in chat timeline</div>
                    )}
                  </button>
                );
              })}
              {items.length === 0 && (
                <div className="rounded-[var(--radius)] border border-white/10 bg-black/30 p-6 text-center text-sm text-white/60">
                  No tasks matched. Kick off a new run to see progress here.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
