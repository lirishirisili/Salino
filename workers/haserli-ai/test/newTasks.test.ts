// npm test — node --experimental-transform-types --test test/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerateListPrompt, generateListTask } from '../src/tasks/generateList.ts';
import { parseImageTask } from '../src/tasks/parseImage.ts';
import { checkDailyQuota, DAILY_LIMITS, utcDay } from '../src/quota.ts';

test('generate-list prompt carries the request, head count and inline schema', () => {
  const prompt = buildGenerateListPrompt({ request: 'ארוחת שישי', people: 8, locale: 'he' }, { inlineSchema: true });
  assert.match(prompt, /ארוחת שישי/);
  assert.match(prompt, /Number of people: 8/);
  assert.match(prompt, /Answer with JSON only/);
  assert.doesNotMatch(buildGenerateListPrompt({ request: 'x y' }, { inlineSchema: false }), /Answer with JSON only/);
});

test('generate-list reuses the list parser', () => {
  const items = generateListTask.parse('{"items":[{"name":"חלה","quantity":2,"unit":"NONE","category":"BAKERY","note":""}]}');
  assert.deepEqual(items, [{ name: 'חלה', quantity: 2, unit: null, category: 'BAKERY', note: '' }]);
});

test('parse-image passes the image to providers', () => {
  const image = { mimeType: 'image/jpeg', data: 'abc' };
  assert.deepEqual(parseImageTask.image?.({ image }), image);
});

function fakeEnv() {
  const store = new Map<string, string>();
  return {
    store,
    env: {
      QUOTA: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => {
          store.set(k, v);
        },
      },
    } as unknown as Env,
  };
}

test('daily quota counts per user and blocks past the limit', async () => {
  const { env, store } = fakeEnv();
  for (let i = 0; i < DAILY_LIMITS.parse_image; i++) {
    assert.equal(await checkDailyQuota(env, 'u1', 'parse_image'), true);
  }
  assert.equal(await checkDailyQuota(env, 'u1', 'parse_image'), false);
  assert.equal(await checkDailyQuota(env, 'u2', 'parse_image'), true);
  assert.equal(await checkDailyQuota(env, 'u1', 'generate_list'), true);
  assert.equal(store.get(`q:parse_image:${utcDay()}:u1`), String(DAILY_LIMITS.parse_image));
});

test('no KV binding = no daily cap', async () => {
  assert.equal(await checkDailyQuota({} as Env, 'u1', 'parse_image'), true);
});
