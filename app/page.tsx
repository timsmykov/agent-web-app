'use client';

import { useEffect } from 'react';
import { ChatTimeline } from '@/components/chat/ChatTimeline';
import { Composer } from '@/components/composer/Composer';
import { VoiceOverlay } from '@/components/voice/VoiceOverlay';
import { TaskDrawer } from '@/components/tasks/TaskDrawer';
import { StatusToasts } from '@/components/StatusToasts';
import { useTaskStore } from '@/store/tasks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/store/chat';
import { Sparkles, Bot, PanelRight } from 'lucide-react';

export default function HomePage() {
  const refreshTasks = useTaskStore((state) => state.refreshTasks);
  const setVoiceOverlayOpen = useChatStore((state) => state.setVoiceOverlayOpen);

  useEffect(() => {
    refreshTasks().catch(() => undefined);
  }, [refreshTasks]);

  return (
    <main className="relative flex min-h-screen flex-col gap-6 px-6 pb-8 pt-10 sm:px-10">
      <VoiceOverlay />
      <StatusToasts />
      <div className="flex flex-col gap-6 lg:flex-row">
        <section className="flex flex-1 flex-col gap-6">
          <header className="flex items-center justify-between rounded-[var(--radius)] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
            <div>
              <div className="flex items-center gap-3 text-sm uppercase tracking-[0.35em] text-white/40">
                <Sparkles className="h-4 w-4 text-[var(--accent-0)]" />
                Aurora Agent
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-gradient">Immersive voice-native workspace</h1>
              <p className="mt-1 text-sm text-white/70">
                Type or speak tasks. I will plan, simulate, and brief you in realtime.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" className="border border-white/10 bg-white/10" onClick={() => setVoiceOverlayOpen(true)}>
                    <Bot className="mr-2 h-4 w-4 text-[var(--accent-0)]" />
                    Voice mode
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hold space, speak, and watch the orb respond.</TooltipContent>
              </Tooltip>
              <TaskDrawer />
            </div>
          </header>
          <div className="flex min-h-[540px] flex-1 flex-col overflow-hidden">
            <ChatTimeline />
          </div>
          <Composer />
        </section>
        <aside className="hidden w-72 flex-col gap-4 lg:flex">
          <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <PanelRight className="h-4 w-4 text-[var(--accent-1)]" />
              Shortcuts
            </div>
            <ul className="mt-4 space-y-3 text-sm text-white/60">
              <li><strong className="text-white/80">/plan</strong> Generate a strategic plan with milestones.</li>
              <li><strong className="text-white/80">/summarize</strong> Condense the latest context into a digest.</li>
              <li><strong className="text-white/80">/run-flow</strong> Spin up a multi-tool automation run.</li>
              <li><strong className="text-white/80">Voice</strong> Toggle mic or press Esc to exit listening.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
