import type { InlineImage, SchemaNode } from './aiHttp.ts';

/**
 * One AI job the worker can run (e.g. "parse a pasted list"). Adding a feature =
 * a new file under tasks/ exporting an AiTask, plus a route in index.ts.
 */
export interface AiTask<Input, Output> {
  /** Short id for logs and the JSON-schema name. */
  id: string;
  /** Gemini-style schema; converted to JSON Schema for OpenAI-compatible providers. */
  schema: SchemaNode;
  /** Prompt text. `inlineSchema` = the provider can't enforce the schema, so describe it in the prompt. */
  buildPrompt(input: Input, options: { inlineSchema: boolean }): string;
  /** Parses + validates a model answer. Throws TaskOutputError when the text isn't usable. */
  parse(raw: string): Output;
  /** Upper bound for the model's answer. */
  maxOutputTokens: number;
  /** Image input: only vision-capable providers (Gemini) race for this task. */
  image?(input: Input): InlineImage;
}

/**
 * The model answered, but not with something this task can use (e.g. the text
 * isn't a shopping list). When every provider fails this way the request is a
 * 422, not a 503.
 */
export class TaskOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskOutputError';
  }
}

/** Strips ```json fences and leading prose some free models add around JSON. */
export function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.search(/[{[]/);
  if (start < 0) return text;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  const end = text.lastIndexOf(close);
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}
