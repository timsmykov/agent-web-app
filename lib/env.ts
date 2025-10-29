const REQUIRED_ENV = ['N8N_WEBHOOK_TEST_URL', 'N8N_WEBHOOK_PROD_URL'] as const;

type EnvKey = (typeof REQUIRED_ENV)[number];

function readEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getN8nUrl(): string {
  REQUIRED_ENV.forEach((key) => readEnv(key));

  const mode = process.env.N8N_MODE === 'prod' ? 'prod' : 'test';
  const target = mode === 'prod' ? readEnv('N8N_WEBHOOK_PROD_URL') : readEnv('N8N_WEBHOOK_TEST_URL');

  try {
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid N8N webhook URL for mode "${mode}": ${(error as Error).message}`);
  }
}
