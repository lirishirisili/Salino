/**
 * Plain-fetch AI provider helpers. Adapted from Tohav (src/features/import/aiHttp.ts):
 * the Gemini call takes the response schema as a parameter instead of a fixed one.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiModelSpec {
  id: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
}

/** Gemini `responseSchema` node (OpenAPI subset; enums use `format: 'enum'`). */
export interface SchemaNode {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  format?: 'enum';
  enum?: string[];
  nullable?: boolean;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  maxItems?: number;
}

export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`[${status}] ${detail}`);
    this.name = 'ProviderHttpError';
  }
}

/** Throws ProviderHttpError with the provider's own error message for non-2xx responses. */
export async function throwForStatus(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.text().catch(() => '');
  let detail = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } | string };
    const message = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message;
    if (typeof message === 'string') detail = message.slice(0, 300);
  } catch {
    // Not JSON — keep the raw snippet.
  }
  throw new ProviderHttpError(response.status, detail || response.statusText);
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

/** An image sent with the prompt (base64, no data: prefix). */
export interface InlineImage {
  mimeType: string;
  data: string;
}

/** Gemini generateContent with `schema` as structured output; returns the answer text without thought parts. */
export async function generateWithGemini(
  apiKey: string,
  model: GeminiModelSpec,
  prompt: string,
  schema: SchemaNode,
  signal: AbortSignal,
  image?: InlineImage,
): Promise<string> {
  const parts: Record<string, unknown>[] = image
    ? [{ inline_data: { mime_type: image.mimeType, data: image.data } }, { text: prompt }]
    : [{ text: prompt }];
  const response = await fetch(`${GEMINI_API_BASE}/${model.id}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        ...(model.thinkingLevel ? { thinkingConfig: { thinkingLevel: model.thinkingLevel } } : {}),
      },
    }),
    signal,
  });
  await throwForStatus(response);

  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('');
  if (!text) {
    const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? 'unknown';
    throw new Error(`Gemini returned no text (${reason})`);
  }
  return text;
}

/** Gemini's schema as standard JSON Schema (its `format: 'enum'` marker isn't part of it). */
export function toJsonSchema({ format: _format, properties, items, ...rest }: SchemaNode): Record<string, unknown> {
  return {
    ...rest,
    ...(properties
      ? { properties: Object.fromEntries(Object.entries(properties).map(([key, node]) => [key, toJsonSchema(node)])) }
      : {}),
    ...(items ? { items: toJsonSchema(items) } : {}),
  };
}
