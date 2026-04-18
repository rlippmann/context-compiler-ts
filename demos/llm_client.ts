export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type Message = {
  role: Role;
  content: string;
};

export type LLMConfig = {
  baseUrl: string | null;
  apiKey: string;
  model: string;
};

export class MissingDemoConfigError extends Error {
  readonly missing: string[];
  readonly baseUrl: string | null;

  constructor(missing: string[], baseUrl: string | null) {
    super(`Missing demo configuration: ${missing.join(', ')}`);
    this.name = 'MissingDemoConfigError';
    this.missing = missing;
    this.baseUrl = baseUrl;
  }
}

export class DemoLLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoLLMError';
  }
}

const RETRY_DELAYS_SECONDS = [1, 2, 4] as const;
const MAX_RETRY_AFTER_SECONDS = 5;
let defaultLlmDelaySeconds = 0;

export function setDefaultLlmDelay(seconds: number): void {
  defaultLlmDelaySeconds = seconds > 0 ? seconds : 0;
}

export function getDefaultLlmDelay(): number {
  return defaultLlmDelaySeconds;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') {
    return null;
  }
  return raw.replace(/\/+$/, '');
}

export function loadConfig(): LLMConfig {
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MODEL;

  const missing: string[] = [];
  if (!apiKey || apiKey.trim() === '') {
    missing.push('OPENAI_API_KEY');
  }
  if (!model || model.trim() === '') {
    missing.push('MODEL');
  }

  if (missing.length > 0) {
    throw new MissingDemoConfigError(missing, baseUrl);
  }

  const apiKeyValue = apiKey as string;
  const modelValue = model as string;

  return {
    baseUrl,
    apiKey: apiKeyValue,
    model: modelValue
  };
}

function endpointFor(baseUrl: string | null): string {
  const root = baseUrl ?? 'https://api.openai.com/v1';
  return `${root}/chat/completions`;
}

function parseRetryAfterSeconds(headers: Headers): number | null {
  const raw = headers.get('retry-after') ?? headers.get('Retry-After');
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  const seconds = Math.ceil((parsed - Date.now()) / 1000);
  return seconds > 0 ? seconds : 0;
}

function retryAfterFromText(text: string): number | null {
  const lowered = text.toLowerCase();
  const patterns = [/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i, /retrydelay\s*[:=]\s*['"]?([0-9]+(?:\.[0-9]+)?)s['"]?/i];
  for (const pattern of patterns) {
    const match = lowered.match(pattern);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 0) {
      continue;
    }
    return Number.isInteger(value) ? value : Math.floor(value) + 1;
  }
  return null;
}

function isLikelyTemperatureRejection(status: number, message: string): boolean {
  if (status < 400 || status >= 500) {
    return false;
  }
  const lowered = message.toLowerCase();
  return (
    lowered.includes('temperature') &&
    (lowered.includes('unsupported') || lowered.includes('not supported') || lowered.includes('invalid'))
  );
}

async function callChatCompletions(
  config: LLMConfig,
  targetModel: string,
  messages: Message[],
  deterministicDecoding: boolean
): Promise<{ status: number; headers: Headers; content: string; errorMessage: string }> {
  const body: Record<string, unknown> = {
    model: targetModel,
    messages
  };
  if (deterministicDecoding) {
    body.temperature = 0;
  }

  const response = await fetch(endpointFor(config.baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fallbackText = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const errorMessage =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error?: { message?: unknown } }).error?.message ?? fallbackText)
        : fallbackText;

    return {
      status: response.status,
      headers: response.headers,
      content: '',
      errorMessage
    };
  }

  const choices =
    typeof payload === 'object' && payload !== null && 'choices' in payload
      ? (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices
      : undefined;

  const content = typeof choices?.[0]?.message?.content === 'string' ? choices[0].message.content : '';

  return {
    status: response.status,
    headers: response.headers,
    content: content.trim(),
    errorMessage: ''
  };
}

export async function completeMessages(
  messages: Message[],
  options?: {
    model?: string;
    delaySeconds?: number;
  }
): Promise<string> {
  const config = loadConfig();
  const targetModel = options?.model ?? config.model;
  const configuredDelay = options?.delaySeconds && options.delaySeconds > 0 ? options.delaySeconds : defaultLlmDelaySeconds;

  for (let attempt = 0; attempt <= RETRY_DELAYS_SECONDS.length; attempt += 1) {
    if (configuredDelay > 0) {
      await sleep(configuredDelay * 1000);
    }

    let firstResult;
    try {
      firstResult = await callChatCompletions(config, targetModel, messages, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < RETRY_DELAYS_SECONDS.length) {
        await sleep(RETRY_DELAYS_SECONDS[attempt] * 1000);
        continue;
      }
      throw new DemoLLMError(
        `Could not reach the configured LLM endpoint after retries. Check OPENAI_BASE_URL and network access. (${message})`
      );
    }

    if (firstResult.status < 400) {
      return firstResult.content;
    }

    if (isLikelyTemperatureRejection(firstResult.status, firstResult.errorMessage)) {
      const retryResult = await callChatCompletions(config, targetModel, messages, false);
      if (retryResult.status < 400) {
        return retryResult.content;
      }
      throw new DemoLLMError(`LLM provider error while calling model '${targetModel}': ${retryResult.errorMessage}`);
    }

    const lowered = firstResult.errorMessage.toLowerCase();
    const retryAfterHeader = parseRetryAfterSeconds(firstResult.headers);
    const retryAfterText = retryAfterFromText(firstResult.errorMessage);
    const retryAfter = retryAfterHeader ?? retryAfterText;

    const isRateLimit = firstResult.status === 429 || lowered.includes('rate limit') || lowered.includes('quota');
    const isAuth = firstResult.status === 401 || lowered.includes('invalid api key') || lowered.includes('unauthorized');
    const isPermission = firstResult.status === 403 || lowered.includes('forbidden') || lowered.includes('access denied');
    const isNotFound = firstResult.status === 404 || lowered.includes('model not found') || lowered.includes('unknown model');
    const isTimeout = lowered.includes('timeout') || lowered.includes('timed out');
    const isConnection = lowered.includes('connection') || lowered.includes('unreachable');

    if (isNotFound) {
      throw new DemoLLMError(
        `Model '${targetModel}' was not found at the configured endpoint. Check MODEL or OPENAI_BASE_URL.`
      );
    }
    if (isAuth) {
      throw new DemoLLMError('Authentication failed. Check OPENAI_API_KEY.');
    }
    if (isPermission) {
      throw new DemoLLMError(`Access to model '${targetModel}' was denied by the configured provider.`);
    }

    if (isRateLimit || isTimeout || isConnection) {
      if (retryAfter !== null && retryAfter > MAX_RETRY_AFTER_SECONDS) {
        throw new DemoLLMError(
          `LLM provider requested retry after ${retryAfter}s, which exceeds the demo retry limit. Try again later or switch providers.`
        );
      }

      if (attempt < RETRY_DELAYS_SECONDS.length) {
        const delay = retryAfter ?? RETRY_DELAYS_SECONDS[attempt];
        await sleep(delay * 1000);
        continue;
      }

      if (isRateLimit) {
        throw new DemoLLMError('LLM provider rate limit exceeded. Try again later or switch providers.');
      }

      throw new DemoLLMError(
        'Could not reach the configured LLM endpoint after retries. Check OPENAI_BASE_URL and network access.'
      );
    }

    throw new DemoLLMError(`LLM provider error while calling model '${targetModel}': ${firstResult.errorMessage}`);
  }

  throw new DemoLLMError('Unexpected LLM retry failure.');
}
