import { NextResponse } from 'next/server';
import { getN8nUrl } from '@/lib/env';
import { payloadSchema, type DispatchPayload } from '@/lib/schemas';
import { safeFetch } from '@/lib/safeFetch';

export async function POST(request: Request) {
  let body: DispatchPayload;

  try {
    const json = await request.json();
    body = payloadSchema.parse(json);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid payload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
  let targetUrl: string;
  try {
    targetUrl = getN8nUrl();
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Configuration error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }

  try {
    const result = await safeFetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      timeoutMs: 15000
    });

    if (result.isJson) {
      return NextResponse.json(result.data ?? { ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    const status = err.status && err.status >= 500 ? err.status : 502;
    const details = err.body;
    return NextResponse.json(
      {
        error: 'Failed to relay message to n8n',
        details: details ?? (error instanceof Error ? error.message : 'Unknown error')
      },
      { status }
    );
  }
}
