'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, SendHorizontal, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/store/chat';
import { useTaskStore } from '@/store/tasks';
import { useToast } from '@/components/ui/toast-provider';
import { cn } from '@/lib/utils/cn';

const commands = [
  {
    command: '/plan',
    label: 'Strategic plan',
    hint: 'Outline actionable steps with milestones.'
  },
  {
    command: '/summarize',
    label: 'Rapid summary',
    hint: 'Condense the latest context into concise insights.'
  },
  {
    command: '/run-flow',
    label: 'Run flow simulation',
    hint: 'Execute multi-tool workflow with validation.'
  }
];

export function Composer() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composer = useChatStore((state) => state.composer);
  const ghostText = useChatStore((state) => state.ghostText);
  const setComposer = useChatStore((state) => state.setComposer);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const setSubmitting = useChatStore((state) => state.setSubmitting);
  const isSubmitting = useChatStore((state) => state.isSubmitting);
  const setHighlightedTaskId = useChatStore((state) => state.setHighlightedTaskId);
  const voiceOverlayOpen = useChatStore((state) => state.voiceOverlayOpen);
  const setVoiceOverlayOpen = useChatStore((state) => state.setVoiceOverlayOpen);
  const setGhostText = useChatStore((state) => state.setGhostText);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const sessionId = useChatStore((state) => state.sessionId);
  const { push } = useToast();
  const createTask = useTaskStore((state) => state.createTask);

  const [commandCursor, setCommandCursor] = useState(0);

  const visibleCommands = useMemo(() => {
    if (!composer.startsWith('/')) return [];
    const term = composer.slice(1).toLowerCase();
    return commands.filter((option) => option.command.includes(term));
  }, [composer]);

  const autoResize = useCallback(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [composer, autoResize]);

  const submit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }
    const input = (composer || ghostText).trim();
    if (!input) {
      push({ title: 'Nothing to send', description: 'Say something or type your request.' });
      return;
    }

    const messageId = crypto.randomUUID();
    const timestamp = Date.now();
    appendMessage({ id: messageId, ts: timestamp, role: 'user', content: input, status: 'pending' });
    setComposer('');
    setGhostText('');
    setSubmitting(true);

    let dispatched = false;

    try {
      const meta = {
        client: 'web',
        sessionId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        lang: 'ru'
      };

      const dispatchResponse = await fetch('/api/n8n/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: { id: messageId, text: input, role: 'user', ts: timestamp },
          meta
        })
      });

      if (!dispatchResponse.ok) {
        const payload = await dispatchResponse.json().catch(() => ({}));
        throw new Error((payload as { error?: string; details?: string }).error ?? 'n8n dispatch failed');
      }

      updateMessage(messageId, { status: 'sent' });
      dispatched = true;

      const taskId = await createTask(input, messageId);
      setHighlightedTaskId(taskId);
    } catch (error) {
      console.error(error);
      if (!dispatched) {
        updateMessage(messageId, { status: 'failed' });
        push({
          title: 'Dispatch failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        });
      } else {
        push({
          title: 'Task failed to start',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        });
      }
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }, [appendMessage, composer, createTask, ghostText, isSubmitting, push, setComposer, setGhostText, setHighlightedTaskId, setSubmitting, sessionId, updateMessage]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
      if (visibleCommands.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setCommandCursor((cursor) => (cursor + 1) % visibleCommands.length);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setCommandCursor((cursor) => (cursor - 1 + visibleCommands.length) % visibleCommands.length);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          const command = visibleCommands[commandCursor]?.command;
          if (command) {
            setComposer(`${command} `);
          }
        }
      }
    },
    [submit, visibleCommands, commandCursor, setComposer]
  );

  const toggleVoice = () => {
    if (voiceOverlayOpen) {
      setVoiceOverlayOpen(false);
      setGhostText('');
    } else {
      setVoiceOverlayOpen(true);
    }
  };

  return (
    <div className="relative rounded-[var(--radius)] border border-white/10 bg-black/40 p-4 backdrop-blur-xl shadow-panel">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Share a task, question, or drop a /command"
          className="min-h-[88px] w-full resize-none rounded-[var(--radius)] border border-white/10 bg-black/40 px-4 py-4 pr-16 text-sm text-white placeholder:text-white/40 focus:border-[var(--accent-0)] focus:outline-none"
        />
        {ghostText && !composer && (
          <div className="pointer-events-none absolute inset-0 flex items-center px-4 py-4 text-sm text-white/40">
            <span className="animate-pulse">{ghostText}</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant={voiceOverlayOpen ? 'outline' : 'ghost'}
            className={cn('border-white/10', voiceOverlayOpen && 'border-[var(--accent-0)] text-[var(--accent-0)]')}
            onClick={toggleVoice}
            aria-pressed={voiceOverlayOpen}
            aria-label="Toggle voice mode"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" onClick={submit} disabled={isSubmitting} aria-label="Send">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-white/40">
        <div className="flex items-center gap-2">
          <Command className="h-3.5 w-3.5" />
          <span>Enter to send · Shift+Enter for newline</span>
        </div>
        <span>Mic: {voiceOverlayOpen ? 'listening' : 'off'} · Esc to exit</span>
      </div>
      {visibleCommands.length > 0 && (
        <div className="absolute bottom-[110px] left-4 w-72 rounded-[var(--radius)] border border-white/10 bg-black/70 p-3 text-sm shadow-xl backdrop-blur-xl">
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">Commands</p>
          <div className="space-y-2">
            {visibleCommands.map((item, index) => (
              <button
                key={item.command}
                type="button"
                onMouseEnter={() => setCommandCursor(index)}
                onClick={() => setComposer(`${item.command} `)}
                className={cn(
                  'w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-[var(--accent-0)] hover:bg-[var(--accent-0)]/10',
                  index === commandCursor && 'border-[var(--accent-0)] bg-[var(--accent-0)]/10'
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                  {item.command}
                </div>
                <div className="text-sm text-white/80">{item.label}</div>
                <div className="text-xs text-white/50">{item.hint}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
