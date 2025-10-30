import { NextResponse } from 'next/server';
import { z } from 'zod';
import { taskStore, type TaskStatus } from '@/lib/tasks/store';

const completionSchema = z
  .object({
    taskId: z.string().min(1).optional(),
    messageId: z.string().min(1).optional(),
    status: z.enum(['queued', 'running', 'need_input', 'succeeded', 'failed'] as const).default('succeeded'),
    step: z.string().min(1).optional(),
    message: z.string().optional(),
    progress: z.number().min(0).max(1).optional(),
    ts: z.number().int().optional()
  })
  .refine((value) => value.taskId || value.messageId, {
    message: 'Either taskId or messageId must be provided.'
  });

type CompletionPayload = z.infer<typeof completionSchema>;

export async function POST(request: Request) {
  let payload: CompletionPayload;
  try {
    const json = await request.json();
    payload = completionSchema.parse(json);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid payload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }

  const taskId = payload.taskId ?? payload.messageId!;

  const status: TaskStatus = payload.status;
  const progress =
    payload.progress !== undefined ? payload.progress : status === 'succeeded' ? 1 : undefined;

  const event = taskStore.pushEvent(taskId, {
    status,
    step: payload.step,
    message: payload.message,
    progress,
    ts: payload.ts
  });

  if (!event) {
    return NextResponse.json({ error: `Task ${taskId} not found.` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, event });
}
