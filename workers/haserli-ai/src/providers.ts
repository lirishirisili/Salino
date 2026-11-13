import { generateWithGemini, throwForStatus, toJsonSchema, type GeminiModelSpec } from './aiHttp.ts';
import { hedgedRace, type RaceCandidate, type RaceWin } from './hedgedRace.ts';
import type { AiTask } from './task.ts';

/**
 * Free providers, fastest-and-smartest first — same order and timing as Tohav's
 * recipe-ai worker (workers/recipe-ai/src/chain.ts), generalized to any AiTask.
 * A provider that hasn't answered within the hedge delay gets company rather
 * than a full wait; the first valid answer wins.
 */
const RACE = { hedgeDelayMs: 3_500, budgetMs: 18_000, maxInFlight: 3 };
const FAST_TIMEOUT_MS = 8_000;
const SLOW_TIMEOUT_MS = 15_000;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** OpenRouter tries these in order within one request; `openrouter/free` picks any free model. */
const OPENROUTER_FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openrouter/free',
];
const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const GEMINI_MODELS: readonly GeminiModelSpec[] = [
  { id: 'gemini-3.1-flash-lite' },
  { id: 'gemini-3.5-flash-lite' },
  { id: 'gemini-3.8-flash', thinkingLevel: 'low' },
];

export interface TaskResult<T> {
  output: T;
  model: string;
}

function optionalSecret(env: Env, name: 'GROQ_API_KEY' | 'OPENROUTER_API_KEY'): string | undefined {
  const value: unknown = Reflect.get(env, name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
}

async function chatCompletion(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ content: string; model?: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
  await throwForStatus(response);
  const data = await response.json<ChatCompletionResponse>();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty response');
  return { content, model: data.model };
}

function buildCandidates<I, O>(task: AiTask<I, O>, input: I, env: Env): RaceCandidate<TaskResult<O>>[] {
  // Gemini and gpt-oss enforce the schema; the rest get JSON mode + the schema in the prompt.
  const schemaPrompt = task.buildPrompt(input, { inlineSchema: false });
  const inlinePrompt = task.buildPrompt(input, { inlineSchema: true });
  const messages = [{ role: 'user' as const, content: inlinePrompt }];
  const jsonSchemaFormat = {
    type: 'json_schema',
    json_schema: { name: task.id.replace(/[^a-z0-9_]/gi, '_'), schema: toJsonSchema(task.schema) },
  };
  const groqKey = optionalSecret(env, 'GROQ_API_KEY');
  const openRouterKey = optionalSecret(env, 'OPENROUTER_API_KEY');
  const [geminiFastest, geminiLite, geminiFlash] = GEMINI_MODELS;

  const image = task.image?.(input);
  const gemini = (model: GeminiModelSpec): RaceCandidate<TaskResult<O>> => ({
    label: `gemini/${model.id}`,
    timeoutMs: SLOW_TIMEOUT_MS,
    run: async (signal) => ({
      output: task.parse(
        await generateWithGemini(env.GEMINI_API_KEY, model, schemaPrompt, task.schema, signal, image),
      ),
      model: model.id,
    }),
  });
  // Vision tasks: only Gemini reads images in this chain.
  if (image) return GEMINI_MODELS.map(gemini);

  const groq = (
    model: string,
    options: { jsonSchema: boolean } & Record<string, unknown>,
  ): RaceCandidate<TaskResult<O>> | null => {
    if (!groqKey) return null;
    const { jsonSchema, ...reasoning } = options;
    return {
      label: `groq/${model}`,
      timeoutMs: FAST_TIMEOUT_MS,
      run: async (signal) => {
        const { content } = await chatCompletion(
          GROQ_URL,
          groqKey,
          {
            model,
            messages: jsonSchema ? [{ role: 'user', content: schemaPrompt }] : messages,
            response_format: jsonSchema ? jsonSchemaFormat : { type: 'json_object' },
            max_completion_tokens: task.maxOutputTokens,
            ...reasoning,
          },
          signal,
        );
        return { output: task.parse(content), model };
      },
    };
  };

  const openRouter: RaceCandidate<TaskResult<O>> | null = openRouterKey
    ? {
        label: 'openrouter',
        timeoutMs: SLOW_TIMEOUT_MS,
        run: async (signal) => {
          const { content, model } = await chatCompletion(
            OPENROUTER_URL,
            openRouterKey,
            {
              models: OPENROUTER_FREE_MODELS,
              messages,
              response_format: { type: 'json_object' },
              max_completion_tokens: task.maxOutputTokens,
            },
            signal,
          );
          return { output: task.parse(content), model: model ?? 'openrouter' };
        },
      }
    : null;

  // The AI binding can't be aborted; the race just stops waiting for it.
  const workersAi: RaceCandidate<TaskResult<O>> = {
    label: `workers-ai/${WORKERS_AI_MODEL}`,
    timeoutMs: SLOW_TIMEOUT_MS,
    run: async () => {
      const result = (await env.AI.run(WORKERS_AI_MODEL as keyof AiModels, {
        messages,
        response_format: { type: 'json_object' },
        chat_template_kwargs: { enable_thinking: false },
        max_completion_tokens: task.maxOutputTokens,
      } as never)) as { choices?: { message?: { content?: string | null } }[]; response?: unknown };
      const content =
        result.choices?.[0]?.message?.content ??
        (typeof result.response === 'string' ? result.response : result.response ? JSON.stringify(result.response) : null);
      if (!content) throw new Error('empty response');
      return { output: task.parse(content), model: WORKERS_AI_MODEL };
    },
  };

  const gptOss = { jsonSchema: true, include_reasoning: false, reasoning_effort: 'low' };
  return [
    groq('openai/gpt-oss-120b', gptOss),
    groq('openai/gpt-oss-20b', gptOss),
    gemini(geminiFastest),
    groq('qwen/qwen3.8-27b', { jsonSchema: false, reasoning_format: 'hidden', reasoning_effort: 'none' }),
    gemini(geminiLite),
    openRouter,
    gemini(geminiFlash),
    workersAi,
  ].filter((candidate): candidate is RaceCandidate<TaskResult<O>> => candidate !== null);
}

export function runTask<I, O>(task: AiTask<I, O>, input: I, env: Env): Promise<RaceWin<TaskResult<O>>> {
  return hedgedRace(buildCandidates(task, input, env), RACE);
}
