import { NextResponse } from 'next/server';
import { taskStore } from '@/lib/tasks/store';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(_: Request, context: Params) {
  const taskId = context.params.id;
  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 });
  }

  const task = taskStore.getTask(taskId);
  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  }

  return NextResponse.json({
    taskId: task.taskId,
    status: task.status,
    history: task.history
  });
}
