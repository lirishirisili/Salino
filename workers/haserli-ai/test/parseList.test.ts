// npm test — node --experimental-transform-types --test test/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildParseListPrompt, parseListJson } from '../src/tasks/parseList.ts';
import { TaskOutputError, extractJsonText } from '../src/task.ts';
import { hedgedRace, RaceFailedError } from '../src/hedgedRace.ts';

test('a clean answer passes through', () => {
  const items = parseListJson(
    JSON.stringify({
      items: [
        { name: 'חלב', quantity: 2, unit: 'NONE', category: 'DAIRY', note: '3%' },
        { name: 'עגבניות', quantity: 1.5, unit: 'KG', category: 'VEGETABLES', note: '' },
      ],
    })
  );
  assert.deepEqual(items, [
    { name: 'חלב', quantity: 2, unit: null, category: 'DAIRY', note: '3%' },
    { name: 'עגבניות', quantity: 1.5, unit: 'KG', category: 'VEGETABLES', note: '' },
  ]);
});

test('bad fields are repaired, not rejected', () => {
  const [item] = parseListJson(
    '{"items":[{"name":"  סבון  כלים ","quantity":"-3","unit":"box","category":"kitchen","note":null}]}'
  );
  assert.deepEqual(item, { name: 'סבון כלים', quantity: 1, unit: null, category: 'OTHER', note: '' });
});

test('lowercase enums and comma decimals are accepted', () => {
  const [item] = parseListJson('{"items":[{"name":"גבינה","quantity":"0,5","unit":"kg","category":"dairy","note":""}]}');
  assert.equal(item.quantity, 0.5);
  assert.equal(item.unit, 'KG');
  assert.equal(item.category, 'DAIRY');
});

test('fenced JSON, prose around it, and a bare array all work', () => {
  assert.equal(
    parseListJson('Sure! ```json\n{"items":[{"name":"לחם","quantity":1,"unit":"NONE","category":"BAKERY","note":""}]}\n```')
      .length,
    1
  );
  assert.equal(parseListJson('[{"name":"bread","quantity":1}]')[0].category, 'OTHER');
  assert.equal(extractJsonText('noise {"a":1} tail'), '{"a":1}');
});

test('the same product twice is merged', () => {
  const items = parseListJson(
    '{"items":[{"name":"ביצים","quantity":12,"unit":"NONE","category":"DAIRY","note":""},' +
      '{"name":"ביצים","quantity":6,"unit":"NONE","category":"DAIRY","note":"L"}]}'
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 18);
  assert.equal(items[0].note, 'L');
});

test('an empty list is a valid quick answer ("nothing to buy")', () => {
  assert.deepEqual(parseListJson('{"items":[]}'), []);
});

test('not JSON / nameless entries → TaskOutputError (next provider is tried)', () => {
  assert.throws(() => parseListJson('I cannot help with that.'), TaskOutputError);
  assert.throws(() => parseListJson('{"items":[{"name":""}]}'), TaskOutputError);
  assert.throws(() => parseListJson('{"answer":"milk"}'), TaskOutputError);
});

test('at most 100 items', () => {
  const many = Array.from({ length: 150 }, (_, i) => ({ name: `item ${i}`, quantity: 1 }));
  assert.equal(parseListJson(JSON.stringify({ items: many })).length, 100);
});

test('the prompt carries the text, the locale and (optionally) the schema', () => {
  const plain = buildParseListPrompt({ text: 'חלב ולחם', locale: 'he' }, { inlineSchema: false });
  const inline = buildParseListPrompt({ text: 'חלב ולחם' }, { inlineSchema: true });
  assert.ok(plain.includes('חלב ולחם'));
  assert.ok(plain.includes('"he"'));
  assert.ok(!plain.includes('Answer with JSON only'));
  assert.ok(inline.includes('Answer with JSON only'));
});

test('race: the first valid answer wins; parse failures are collected', async () => {
  const win = await hedgedRace(
    [
      { label: 'bad', timeoutMs: 1000, run: async () => parseListJson('nope') },
      { label: 'good', timeoutMs: 1000, run: async () => parseListJson('[{"name":"x","quantity":1}]') },
    ],
    { hedgeDelayMs: 10, budgetMs: 2000, maxInFlight: 2 }
  );
  assert.equal(win.label, 'good');

  await assert.rejects(
    hedgedRace(
      [{ label: 'bad', timeoutMs: 1000, run: async () => parseListJson('not json') }],
      { hedgeDelayMs: 10, budgetMs: 2000, maxInFlight: 1 }
    ),
    (error: unknown) =>
      error instanceof RaceFailedError && error.causes.every((cause) => cause instanceof TaskOutputError)
  );
});
