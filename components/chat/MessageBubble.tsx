'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { Clipboard, Check, Bot, User, AlertTriangle } from 'lucide-react';
import type { ChatMessage, TaskEvent } from '@/lib/tasks/store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

interface MessageBubbleProps {
  message: ChatMessage;
  isHighlighted?: boolean;
}

const roleIcon = {
  user: <User className="h-4 w-4" />,
  agent: <Bot className="h-4 w-4" />,
  system: <Bot className="h-4 w-4" />,
  tool: <Bot className="h-4 w-4" />
} as const;

function isTaskEvent(data: unknown): data is TaskEvent {
  return Boolean(data && typeof data === 'object' && 'taskId' in data && 'status' in data);
}

const statusCopy: Record<string, { label: string; badge: 'default' | 'success' | 'warn' | 'danger' }> = {
  running: { label: 'In Progress', badge: 'default' },
  queued: { label: 'Queued', badge: 'default' },
  need_input: { label: 'Needs Input', badge: 'warn' },
  succeeded: { label: 'Completed', badge: 'success' },
  failed: { label: 'Failed', badge: 'danger' }
};

export function MessageBubble({ message, isHighlighted }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isTool = message.role === 'tool';
  const event = isTaskEvent(message.data) ? message.data : undefined;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const markdownComponents: Components = {
    code({ inline, className, children, ...props }: any) {
      if (inline) {
        return (
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="relative mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3 text-left text-xs">
          <code className={cn('block text-xs leading-relaxed', className)} {...props}>
            {children}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(String(children))}
            className="absolute right-3 top-3 text-white/60 hover:text-white"
            aria-label="Copy code"
          >
            <Clipboard className="h-4 w-4" />
          </button>
        </pre>
      );
    },
    a({ children, href, ...props }) {
      return (
        <a
          className="text-[var(--accent-0)] underline decoration-dotted underline-offset-4 hover:text-[var(--accent-1)]"
          href={href as string}
          target="_blank"
          rel="noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul({ children }) {
      return <ul className="ml-6 list-disc space-y-1 text-left">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="ml-6 list-decimal space-y-1 text-left">{children}</ol>;
    }
  };

  if (isTool && event) {
    const statusMeta = statusCopy[event.status] ?? statusCopy.running;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative rounded-[var(--radius)] border border-white/10 bg-white/5 p-4 backdrop-blur-lg transition-shadow',
          isHighlighted ? 'ring-2 ring-[var(--accent-0)] shadow-glow' : 'shadow-panel'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
            <span>{event.step ?? 'TASK'}</span>
            <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
          </div>
          <button
            type="button"
            className="text-white/70 transition hover:text-white"
            onClick={handleCopy}
            aria-label="Copy step"
          >
            {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/80">{message.content}</p>
        {typeof event.progress === 'number' ? (
          <div className="mt-4 h-2 w-full rounded-full bg-white/10">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r from-[var(--accent-0)] to-[var(--accent-1)] transition-all',
                event.status === 'failed' && 'from-danger to-danger/70',
                event.status === 'need_input' && 'from-warn to-warn/70'
              )}
              style={{ width: `${Math.round(event.progress * 100)}%` }}
            />
          </div>
        ) : null}
        <div className="mt-2 text-xs text-white/50">
          {new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', message.role === 'user' ? 'flex-row-reverse text-right' : 'flex-row')}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur',
          isHighlighted ? 'ring-2 ring-[var(--accent-0)]' : ''
        )}
      >
        {roleIcon[message.role]}
      </div>
      <div className="flex max-w-3xl flex-col gap-2">
        <div
          className={cn(
            'relative w-fit max-w-3xl rounded-[var(--radius)] px-4 py-3 text-sm leading-relaxed shadow-panel backdrop-blur-xl',
            message.role === 'user'
              ? 'ml-auto bg-gradient-to-br from-white/10 to-white/5 text-white'
              : 'bg-white/5 text-white/90'
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm as any]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
          {message.role === 'user' && message.status && message.status !== 'sent' ? (
            <span
              className={cn(
                'mt-2 block text-xs',
                message.status === 'failed' ? 'text-danger' : 'text-white/60'
              )}
            >
              {message.status === 'failed' ? 'Не удалось отправить' : 'Отправляется…'}
            </span>
          ) : null}
          {message.role === 'agent' && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute -bottom-4 right-4 flex h-8 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 text-xs text-white/60 transition hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
        {message.role === 'system' ? (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>System guidance</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
