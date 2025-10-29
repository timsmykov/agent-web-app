import { NextResponse } from 'next/server';
import { taskStore, type TaskStatus } from '@/lib/tasks/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = typeof body?.input === 'string' ? body.input.trim() : '';
    if (!input) {
      return NextResponse.json({ error: 'Input must be a non-empty string.' }, { status: 400 });
    }

    const task = taskStore.createTask(input);
    return NextResponse.json({ taskId: task.taskId }, { status: 201 });
  } catch (error) {
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
