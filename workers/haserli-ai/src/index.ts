import { verifyFirebaseIdToken } from './auth.ts';
import { RaceFailedError } from './hedgedRace.ts';
import { runTask } from './providers.ts';
import { TaskOutputError } from './task.ts';
import { MAX_INPUT_CHARS, parseListTask } from './tasks/parseList.ts';

/**
 * haserli-ai — free-AI helper for the Haserli app (Firebase project salino-aaf86).
 * Engine copied from Tohav's recipe-ai worker; tasks live in src/tasks/.
 *
 *   POST /v1/parse-list   { text, locale? } → { items, provider, model, ms }
 *
 * Auth: `Authorization: Bearer <Firebase ID token>`. Rate limit per uid.
 */

const MAX_BODY_BYTES = 32 * 1024;

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

function describe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

async function authenticate(request: Request, env: Env): Promise<string | Response> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    return await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch (error) {
    console.log(JSON.stringify({ event: 'auth_failed', reason: describe(error) }));
    return json({ error: 'unauthorized' }, 401);
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  try {
    const body = JSON.parse(raw) as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : json({ error: 'invalid_json' }, 400);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
}

async function handleParseList(body: Record<string, unknown>, env: Env): Promise<Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 2) return json({ error: 'missing_text' }, 400);
  if (text.length > MAX_INPUT_CHARS) return json({ error: 'payload_too_large' }, 413);
  const locale = typeof body.locale === 'string' ? body.locale.slice(0, 10) : undefined;

  const startedAt = Date.now();
  try {
    const win = await runTask(parseListTask, { text, locale }, env);
    console.log(
      JSON.stringify({
        event: 'parse_list',
        ok: true,
        provider: win.label,
        model: win.value.model,
        items: win.value.output.length,
        chars: text.length,
        ms: win.elapsedMs,
        failures: win.failures,
      }),
    );
    if (win.value.output.length === 0) {
      return json({ error: 'not_a_list', provider: win.label, ms: win.elapsedMs }, 422);
    }
    return json({ items: win.value.output, provider: win.label, model: win.value.model, ms: win.elapsedMs });
  } catch (error) {
    const failures = error instanceof RaceFailedError ? error.failures : [describe(error)];
    const notAList =
      error instanceof RaceFailedError &&
      error.causes.length > 0 &&
      error.causes.every((cause) => cause instanceof TaskOutputError);
    console.log(JSON.stringify({ event: 'parse_list', ok: false, ms: Date.now() - startedAt, failures }));
    return notAList
      ? json({ error: 'not_a_list', attempts: failures }, 422)
      : json({ error: 'all_providers_failed', attempts: failures }, 503);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/v1/parse-list') return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const uid = await authenticate(request, env);
    if (uid instanceof Response) return uid;

    const { success } = await env.USER_RATE_LIMITER.limit({ key: uid });
    if (!success) return json({ error: 'rate_limited' }, 429);

    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return handleParseList(body, env);
  },
} satisfies ExportedHandler<Env>;
