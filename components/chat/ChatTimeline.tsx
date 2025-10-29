'use client';

import { useMemo, useEffect, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useChatStore } from '@/store/chat';
import { MessageBubble } from './MessageBubble';

export function ChatTimeline() {
  const messages = useChatStore((state) => state.messages);
  const highlightedTaskId = useChatStore((state) => state.highlightedTaskId);
  const ensureWelcome = useChatStore((state) => state.ensureWelcome);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    ensureWelcome();
  }, [ensureWelcome]);

  const sorted = useMemo(() => [...messages].sort((a, b) => a.ts - b.ts), [messages]);

  useEffect(() => {
    if (!virtuosoRef.current) return;
    virtuosoRef.current.scrollToIndex({ index: sorted.length - 1, align: 'end', behavior: 'smooth' });
  }, [sorted.length]);

  return (
    <div className="relative flex-1 overflow-hidden rounded-[var(--radius)] border border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={sorted}
        overscan={200}
        itemContent={(_, message) => (
          <div className="px-6 py-4">
            <MessageBubble
              key={message.id}
              message={message}
              isHighlighted={Boolean(highlightedTaskId && message.taskId === highlightedTaskId)}
            />
          </div>
        )}
      />
    </div>
  );
}
