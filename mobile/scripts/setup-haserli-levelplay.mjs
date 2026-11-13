/**
 * Haserli LevelPlay setup for the 1.3.56 ad features (both App Keys):
 *
 * 1. A "Rewarded" ad unit (reward "Unlock" x1) with ironSource + Unity Ads bidders
 *    (Unity: the project's default Rewarded_Android / Rewarded_iOS placements).
 *    Meta offers rewarded to gaming apps only, so no Meta here.
 * 2. Native ad unit activated with an ironSource bidder in its groups.
 * 3. Named placements so revenue is reported per spot. Capping stays off: the
 *    caps live in the app (src/services/interstitialAd.ts, adsConfig.ts).
 *
 * Read-only unless --apply is passed. Never changes existing banner /
 * interstitial / MREC units or their groups. Based on Keepsi's
 * scripts/enable-keepsi-rewarded.mjs.
 *
 * Usage: node scripts/setup-haserli-levelplay.mjs [--apply]
 */
import fs from 'node:fs';

const ENV_PATH = 'C:/Users/liron/.cursor/secrets/monetization.env';
const APPLY = process.argv.includes('--apply');
const BASE = 'https://platform.ironsrc.com';

const APPS = [
  { name: 'Android', appKey: '279039915', unity: { gameId: '6164602', placement: 'Rewarded_Android' } },
  { name: 'iOS', appKey: '279040c25', unity: { gameId: '6164603', placement: 'Rewarded_iOS' } },
];

const REWARD = { rewardItemName: 'Unlock', rewardAmount: 1 };

/** Must match LEVELPLAY_PLACEMENTS in src/config/levelPlay.ts. */
const PLACEMENTS = [
  { adUnit: 'interstitial', name: 'paste_done' },
  { adUnit: 'interstitial', name: 'trip_home_created' },
  { adUnit: 'interstitial', name: 'ai_gate' },
  { adUnit: 'banner', name: 'activity' },
  { adUnit: 'banner', name: 'smart_result' },
  { adUnit: 'banner', name: 'insights' },
  { adUnit: 'rewardedVideo', name: 'photo_list' },
  { adUnit: 'rewardedVideo', name: 'smart_list' },
  { adUnit: 'rewardedVideo', name: 'forgotten_items' },
  { adUnit: 'rewardedVideo', name: 'insights_full' },
  { adUnit: 'nativeAd', name: 'list_end' },
];

function loadEnv(path) {
  return Object.fromEntries(
    fs
      .readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
}

async function auth(env) {
  const response = await fetch(`${BASE}/partners/publisher/auth`, {
    headers: { secretkey: env.LEVELPLAY_SECRET_KEY, refreshToken: env.LEVELPLAY_REFRESH_TOKEN },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`auth ${response.status}: ${text.slice(0, 200)}`);
  return text.replace(/^"|"$/g, '');
}

async function lp(token, method, url, body) {
  if (!APPLY && method !== 'GET') {
    console.log(`[read-only] would ${method} ${url}`, JSON.stringify(body));
    return null;
  }
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  console.log(`${method} ${url.replace(BASE, '')} => ${response.status}`);
  if (!response.ok) {
    console.log(typeof parsed === 'string' ? parsed.slice(0, 800) : JSON.stringify(parsed).slice(0, 800));
    throw new Error(`${method} ${url} failed`);
  }
  return parsed;
}

const env = loadEnv(ENV_PATH);
const token = await auth(env);
const summary = {};

/** Adds bidder instances to every group of an ad unit (keeps what is there). */
async function addBiddersToGroups(appKey, adUnitId, bidderIds) {
  const groupsUrl = `${BASE}/levelPlay/groups/v4/${appKey}/`;
  const groups = ((await lp(token, 'GET', groupsUrl)) ?? []).filter((g) => g.mediationAdUnitId === adUnitId);
  const updates = groups
    .map((g) => {
      const have = (g.instances ?? []).map((i) => i.id);
      const all = [...new Set([...have, ...bidderIds])];
      return all.length === have.length ? null : { groupId: g.groupId, instances: all.map((id) => ({ id })) };
    })
    .filter(Boolean);
  console.log(`  groups for ${adUnitId}: ${groups.length}, needing bidders: ${updates.length}`);
  if (updates.length) await lp(token, 'PUT', groupsUrl, updates);
}

const FORMAT_ALIASES = { rewarded: ['rewarded', 'rewardedVideo'], native: ['native', 'nativeAd'] };
const sameFormat = (a, b) => (FORMAT_ALIASES[b] ?? [b]).includes(a);

async function ensureInstance(appKey, _staleInstances, adFormat, networkName, extra = {}) {
  const instancesUrl = `${BASE}/levelPlay/network/instances/v4/${appKey}/`;
  // Fresh list: creating an ad unit can add an ironSource bidder on its own.
  const instances = (await lp(token, 'GET', instancesUrl)) ?? [];
  let inst = instances.find(
    (i) => sameFormat(i.adFormat, adFormat) && String(i.networkName).toLowerCase() === networkName.toLowerCase(),
  );
  if (!inst) {
    const created = await lp(token, 'POST', instancesUrl, [
      { instanceName: 'Bidding', networkName, adFormat, isBidder: true, isLive: true, ...extra },
    ]);
    inst = Array.isArray(created) ? created[0] : created;
    if (APPLY && !inst?.instanceId) {
      inst = ((await lp(token, 'GET', instancesUrl)) ?? []).find(
        (i) => sameFormat(i.adFormat, adFormat) && String(i.networkName).toLowerCase() === networkName.toLowerCase(),
      );
    }
  } else if (!inst.isLive) {
    await lp(token, 'PUT', instancesUrl, [{ instanceId: inst.instanceId, isLive: true }]);
  }
  return inst;
}

for (const app of APPS) {
  console.log(`\n=== ${app.name} (${app.appKey}) ===`);
  const adUnitsUrl = `${BASE}/levelPlay/adUnits/v1/${app.appKey}`;
  const instancesUrl = `${BASE}/levelPlay/network/instances/v4/${app.appKey}/`;

  let units = (await lp(token, 'GET', adUnitsUrl)) ?? [];
  console.log(
    'ad units:',
    units.map((u) => `${u.adFormat}:${u.mediationAdUnitName}${u.isPaused ? '(paused)' : ''}`).join(', '),
  );
  const instances = (await lp(token, 'GET', instancesUrl)) ?? [];
  console.log(
    'instances:',
    [...new Set(instances.map((i) => `${i.adFormat}/${i.networkName}${i.isLive ? '' : '(off)'}`))].join(', '),
  );

  // 1. Rewarded.
  let rewarded = units.find((u) => u.adFormat === 'rewarded');
  if (!rewarded) {
    await lp(token, 'POST', adUnitsUrl, [{ mediationAdUnitName: 'Rewarded', adFormat: 'rewarded', reward: REWARD }]);
    if (APPLY) {
      units = (await lp(token, 'GET', adUnitsUrl)) ?? [];
      rewarded = units.find((u) => u.adFormat === 'rewarded');
    }
  }
  console.log(`rewarded ad unit: ${rewarded?.mediationAdUnitId ?? '(not created)'}`);
  summary[app.name] = { rewarded: rewarded?.mediationAdUnitId ?? null };
  if (rewarded) {
    const iron = await ensureInstance(app.appKey, instances, 'rewarded', 'ironSource');
    const unity = await ensureInstance(app.appKey, instances, 'rewarded', 'unityAds', {
      appConfig1: app.unity.gameId,
      instanceConfig1: app.unity.placement,
    });
    const ids = [iron?.instanceId, unity?.instanceId].filter(Boolean);
    if (ids.length) await addBiddersToGroups(app.appKey, rewarded.mediationAdUnitId, ids);
    if (rewarded.isPaused) {
      await lp(token, 'PUT', adUnitsUrl, [{ mediationAdUnitId: rewarded.mediationAdUnitId, isPaused: false }]);
    }
  }

  // 2. Native.
  let native = units.find((u) => u.adFormat === 'native');
  if (!native) {
    await lp(token, 'POST', adUnitsUrl, [{ mediationAdUnitName: 'Native', adFormat: 'native' }]);
    if (APPLY) {
      units = (await lp(token, 'GET', adUnitsUrl)) ?? [];
      native = units.find((u) => u.adFormat === 'native');
    }
  }
  console.log(`native ad unit: ${native?.mediationAdUnitId ?? '(not created)'}${native?.isPaused ? ' (paused)' : ''}`);
  summary[app.name].native = native?.mediationAdUnitId ?? null;
  if (native) {
    const iron = await ensureInstance(app.appKey, instances, 'native', 'ironSource');
    if (iron?.instanceId) await addBiddersToGroups(app.appKey, native.mediationAdUnitId, [iron.instanceId]);
    if (native.isPaused) {
      await lp(token, 'PUT', adUnitsUrl, [{ mediationAdUnitId: native.mediationAdUnitId, isPaused: false }]);
    }
  }

  // 3. Named placements.
  const placementsUrl = `${BASE}/partners/publisher/placements/v1/?appKey=${app.appKey}`;
  const existing = (await lp(token, 'GET', placementsUrl)) ?? [];
  console.log('existing placements:', existing.map((p) => `${p.adUnit}:${p.name}`).join(', '));
  const missing = PLACEMENTS.filter((p) => !existing.some((e) => e.adUnit === p.adUnit && e.name === p.name));
  console.log(`placements missing: ${missing.map((p) => `${p.adUnit}:${p.name}`).join(', ') || 'none'}`);
  if (missing.length > 0) {
    await lp(token, 'POST', `${BASE}/partners/publisher/placements/v1`, {
      appKey: app.appKey,
      placements: missing.map((p) => ({
        adUnit: p.adUnit,
        name: p.name,
        adDelivery: 1,
        ...(p.adUnit === 'rewardedVideo' ? { itemName: REWARD.rewardItemName, rewardAmount: REWARD.rewardAmount } : {}),
        // Off, but the API still requires the amounts.
        capping: { enabled: 0, cappingLimit: 999, cappingInterval: 'd' },
        pacing: { enabled: 0, pacingMinutes: 1 },
      })),
    });
  }
}

console.log('\nAd unit IDs for src/config/levelPlay.ts:', JSON.stringify(summary));
if (!APPLY) console.log('Read-only run. Pass --apply to create what is missing.');
