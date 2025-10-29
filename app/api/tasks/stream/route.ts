import { taskStore } from '@/lib/tasks/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return new Response('Missing taskId', { status: 400 });
  }

  const encoder = new TextEncoder();
  let closeStream = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const subscriberId = crypto.randomUUID();

      const send = (event: unknown) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      controller.enqueue(encoder.encode(': connected\n\n'));

      const current = taskStore.getTask(taskId);
      if (current) {
        for (const event of current.history) {
          send(event);
        }
      }

      taskStore.subscribe(taskId, {
        id: subscriberId,
        send
      });

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      const finalize = () => {
        clearInterval(ping);
        taskStore.unsubscribe(taskId, subscriberId);
        try {
          controller.close();
        } catch (error) {
          console.error('Failed to close SSE controller', error);
        }
      };

      const abortSignal = (request as unknown as { signal?: AbortSignal }).signal;
      abortSignal?.addEventListener('abort', finalize, { once: true });

      closeStream = finalize;
    },
    cancel() {
      closeStream();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    }
  });
}
