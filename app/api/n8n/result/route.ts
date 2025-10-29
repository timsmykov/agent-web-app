import { NextResponse } from 'next/server';
import { getN8nProdUrl } from '@/lib/env';
import { n8nResultSchema, type N8nResultPayload } from '@/lib/schemas';
import { safeFetch } from '@/lib/safeFetch';

export async function POST(request: Request) {
  let body: N8nResultPayload;

  try {
    const json = await request.json();
    body = n8nResultSchema.parse(json);
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
    targetUrl = getN8nProdUrl();
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
      body: JSON.stringify({
        message: {
          text: body.text
        }
      }),
      timeoutMs: 15000
    });

    if (result.isJson) {
      return NextResponse.json(result.data ?? { ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    const status = err.status && err.status >= 400 ? err.status : 502;
    const details = err.body ?? (error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        error: 'Failed to query n8n result',
        details
      },
      { status }
    );
  }
}
