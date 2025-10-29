export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export interface SafeFetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | string | null;
  isJson: boolean;
  headers: Headers;
}

export async function safeFetch<T = unknown>(
  input: string,
  init: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000);

  try {
    const response = await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    let payload: T | string | null = null;

    if (isJson) {
      try {
        payload = (await response.json()) as T;
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
      }
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      (error as Error & { status?: number; body?: unknown }).status = response.status;
      (error as Error & { status?: number; body?: unknown }).body = payload;
      throw error;
    }

    return {
      ok: true,
      status: response.status,
      data: payload,
      isJson,
      headers: response.headers
    };
  } finally {
    clearTimeout(timeout);
  }
}
