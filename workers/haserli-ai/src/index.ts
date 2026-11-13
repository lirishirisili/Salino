import { verifyFirebaseIdToken } from './auth.ts';
import { RaceFailedError } from './hedgedRace.ts';
import { runTask } from './providers.ts';
import { TaskOutputError, type AiTask } from './task.ts';
import { MAX_INPUT_CHARS, parseListTask, type ParsedListItem } from './tasks/parseList.ts';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BASE64_CHARS, parseImageTask } from './tasks/parseImage.ts';
import { MAX_PEOPLE, MAX_REQUEST_CHARS, generateListTask } from './tasks/generateList.ts';
import { checkDailyQuota, type QuotaKind } from './quota.ts';

/**
 * haserli-ai — free-AI helper for the Haserli app (Firebase project salino-aaf86).
 * Engine copied from Tohav's recipe-ai worker; tasks live in src/tasks/.
 *
 *   POST /v1/parse-list     { text, locale? }                → { items, provider, model, ms }
 *   POST /v1/parse-image    { image, mimeType, locale? }     → same (photo / screenshot → list)
 *   POST /v1/generate-list  { request, people?, locale? }    → same ("Friday dinner for 8" → list)
 *
 * Auth: `Authorization: Bearer <Firebase ID token>`. Rate limit per uid, plus a
 * daily cap per uid on the image / generate routes (KV `QUOTA`, when bound).
 */

const MAX_BODY_BYTES = 32 * 1024;
const MAX_IMAGE_BODY_BYTES = MAX_IMAGE_BASE64_CHARS + 4 * 1024;

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

async function readJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown> | Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) {
    return json({ error: 'payload_too_large' }, 413);
  }
  const raw = await request.text();
  if (raw.length > maxBytes) return json({ error: 'payload_too_large' }, 413);
  try {
    const body = JSON.parse(raw) as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : json({ error: 'invalid_json' }, 400);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
}

const readLocale = (body: Record<string, unknown>): string | undefined =>
  typeof body.locale === 'string' ? body.locale.slice(0, 10) : undefined;

/** Runs a list-producing task and maps the outcome to the shared response shape. */
async function runListTask<I>(
  task: AiTask<I, ParsedListItem[]>,
  input: I,
  env: Env,
  logFields: Record<string, unknown>,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    const win = await runTask(task, input, env);
    console.log(
      JSON.stringify({
        event: task.id,
        ok: true,
        provider: win.label,
        model: win.value.model,
        items: win.value.output.length,
        ms: win.elapsedMs,
        failures: win.failures,
        ...logFields,
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
    console.log(JSON.stringify({ event: task.id, ok: false, ms: Date.now() - startedAt, failures, ...logFields }));
    return notAList
      ? json({ error: 'not_a_list', attempts: failures }, 422)
      : json({ error: 'all_providers_failed', attempts: failures }, 503);
  }
}

function handleParseList(body: Record<string, unknown>, env: Env): Promise<Response> | Response {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 2) return json({ error: 'missing_text' }, 400);
  if (text.length > MAX_INPUT_CHARS) return json({ error: 'payload_too_large' }, 413);
  return runListTask(parseListTask, { text, locale: readLocale(body) }, env, { chars: text.length });
}

function handleParseImage(body: Record<string, unknown>, env: Env): Promise<Response> | Response {
  const data = typeof body.image === 'string' ? body.image.replace(/^data:[^,]*,/, '').trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : 'image/jpeg';
  if (data.length < 100 || !/^[A-Za-z0-9+/=\r\n]+$/.test(data)) return json({ error: 'missing_image' }, 400);
  if (data.length > MAX_IMAGE_BASE64_CHARS) return json({ error: 'payload_too_large' }, 413);
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return json({ error: 'bad_mime_type' }, 400);
  return runListTask(parseImageTask, { image: { mimeType, data }, locale: readLocale(body) }, env, {
    bytes: Math.round((data.length * 3) / 4),
  });
}

function handleGenerateList(body: Record<string, unknown>, env: Env): Promise<Response> | Response {
  const request = typeof body.request === 'string' ? body.request.replace(/\s+/g, ' ').trim() : '';
  if (request.length < 2) return json({ error: 'missing_request' }, 400);
  if (request.length > MAX_REQUEST_CHARS) return json({ error: 'payload_too_large' }, 413);
  const peopleRaw = typeof body.people === 'number' ? Math.round(body.people) : undefined;
  const people = peopleRaw && peopleRaw > 0 ? Math.min(peopleRaw, MAX_PEOPLE) : undefined;
  return runListTask(generateListTask, { request, people, locale: readLocale(body) }, env, {
    chars: request.length,
    people: people ?? null,
  });
}

type Route = {
  maxBodyBytes: number;
  quota?: QuotaKind;
  handle: (body: Record<string, unknown>, env: Env) => Promise<Response> | Response;
};

const ROUTES: Record<string, Route> = {
  '/v1/parse-list': { maxBodyBytes: MAX_BODY_BYTES, handle: handleParseList },
  '/v1/parse-image': { maxBodyBytes: MAX_IMAGE_BODY_BYTES, quota: 'parse_image', handle: handleParseImage },
  '/v1/generate-list': { maxBodyBytes: MAX_BODY_BYTES, quota: 'generate_list', handle: handleGenerateList },
};

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const route = ROUTES[pathname];
    if (!route) return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const uid = await authenticate(request, env);
    if (uid instanceof Response) return uid;

    const { success } = await env.USER_RATE_LIMITER.limit({ key: uid });
    if (!success) return json({ error: 'rate_limited' }, 429);

    const body = await readJsonBody(request, route.maxBodyBytes);
    if (body instanceof Response) return body;

    if (route.quota && !(await checkDailyQuota(env, uid, route.quota))) {
      return json({ error: 'daily_quota' }, 429);
    }
    return route.handle(body, env);
  },
} satisfies ExportedHandler<Env>;
