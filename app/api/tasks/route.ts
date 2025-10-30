import { NextResponse } from 'next/server';
import { getN8nMode } from '@/lib/env';
import { taskStore, type TaskStatus } from '@/lib/tasks/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = typeof body?.input === 'string' ? body.input.trim() : '';
    if (!input) {
      return NextResponse.json({ error: 'Input must be a non-empty string.' }, { status: 400 });
    }

    const taskIdInput =
      typeof body?.taskId === 'string' && body.taskId.trim().length > 0 ? body.taskId.trim() : undefined;
    const mode = getN8nMode();
    const simulate = mode !== 'prod';

    const task = taskStore.createTask(input, { taskId: taskIdInput, simulate });

    if (!simulate) {
      taskStore.pushEvent(task.taskId, {
        status: 'running',
        step: 'DISPATCH',
        message: 'Workflow dispatched to n8n.',
        progress: 0.05
      });
    }
    return NextResponse.json({ taskId: task.taskId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /already exists/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to create task', error);
    return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as TaskStatus | null;
    const items = taskStore.listTasks(statusParam ?? undefined);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to list tasks', error);
    return NextResponse.json({ error: 'Failed to list tasks.' }, { status: 500 });
  }
}
