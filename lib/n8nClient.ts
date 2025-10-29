export type N8nClientResponse = {
  status: 'success' | 'error';
  message: string;
  raw?: unknown;
};

export async function sendRequestToN8n(text: string): Promise<N8nClientResponse> {
  try {
    const response = await fetch('/api/n8n/result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        (payload as { error?: string; details?: string; message?: string }).message ||
        (payload as { error?: string; details?: string }).details ||
        (payload as { error?: string }).error ||
        `n8n request failed with status ${response.status}`;
      return { status: 'error', message, raw: payload };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      [key: string]: unknown;
    };

    const message =
      payload?.message ||
      (payload?.status ? `n8n responded with status: ${payload.status}` : 'n8n request succeeded');
    return { status: 'success', message, raw: payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    return { status: 'error', message };
  }
}
