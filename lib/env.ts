const REQUIRED_ENV = ['N8N_WEBHOOK_TEST_URL', 'N8N_WEBHOOK_PROD_URL'] as const;

type N8nMode = 'test' | 'prod';

type EnvKey = (typeof REQUIRED_ENV)[number];

function readEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function validateUrl(raw: string, label: string): string {
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid N8N webhook URL for ${label}: ${(error as Error).message}`);
  }
}

export function getN8nUrl(): string {
  REQUIRED_ENV.forEach((key) => readEnv(key));

  const mode = getN8nMode();
  const target = mode === 'prod' ? readEnv('N8N_WEBHOOK_PROD_URL') : readEnv('N8N_WEBHOOK_TEST_URL');

  return validateUrl(target, `${mode} mode`);
}

export function getN8nProdUrl(): string {
  return validateUrl(readEnv('N8N_WEBHOOK_PROD_URL'), 'production mode');
}

export function getN8nMode(): N8nMode {
  return process.env.N8N_MODE === 'prod' ? 'prod' : 'test';
}
