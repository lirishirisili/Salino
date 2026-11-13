/**
 * Create the one-time "Remove ads" product (haserli_remove_ads) in App Store
 * Connect: non-consumable, en-US + he localizations, USD 4.99 base price,
 * available in all territories. Safe to re-run: existing pieces are reused.
 *
 * Usage: node scripts/create-remove-ads-iap.mjs
 *
 * Still manual in App Store Connect: the review screenshot, then submit the
 * IAP together with the next app version.
 */
import {ascFetch} from 'file:///C:/Users/liron/.cursor/skills/store-publish/scripts/asc-client.mjs';

const APP_ID = '6768352555';
const PRODUCT_ID = 'haserli_remove_ads';
const BASE_PRICE_USD = '4.99';

const LOCALIZATIONS = [
  {locale: 'en-US', name: 'Remove ads', description: 'Removes every ad from Haserli for good.'},
  {locale: 'he', name: 'הסרת פרסומות', description: 'מסירה את כל הפרסומות מחסרלי לתמיד.'},
];

async function findOrCreateIap() {
  const existing = await ascFetch(
    `/v1/apps/${APP_ID}/inAppPurchasesV2?filter[productId]=${PRODUCT_ID}&limit=10`,
  );
  if (existing.data?.length) {
    console.log('IAP exists:', existing.data[0].id);
    return existing.data[0].id;
  }
  const created = await ascFetch('/v2/inAppPurchases', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchases',
        attributes: {
          name: 'Remove ads',
          productId: PRODUCT_ID,
          inAppPurchaseType: 'NON_CONSUMABLE',
          familySharable: true,
          reviewNote:
            'One-time purchase. After buying, the app stops loading all ads (banner, MREC, native, interstitial, rewarded) and unlocks the AI features without ads. Settings → Remove ads / Restore purchases.',
        },
        relationships: {app: {data: {type: 'apps', id: APP_ID}}},
      },
    }),
  });
  console.log('IAP created:', created.data.id);
  return created.data.id;
}

async function ensureLocalizations(iapId) {
  const existing = await ascFetch(`/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations?limit=50`);
  const have = new Set((existing.data ?? []).map((l) => l.attributes.locale));
  for (const loc of LOCALIZATIONS) {
    if (have.has(loc.locale)) continue;
    await ascFetch('/v1/inAppPurchaseLocalizations', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'inAppPurchaseLocalizations',
          attributes: loc,
          relationships: {inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iapId}}},
        },
      }),
    });
    console.log('localization added:', loc.locale);
  }
}

async function ensurePrice(iapId) {
  let next = `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=USA&limit=200`;
  let point = null;
  while (next && !point) {
    const page = await ascFetch(next);
    point = (page.data ?? []).find((p) => p.attributes.customerPrice === BASE_PRICE_USD);
    next = page.links?.next ? page.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  if (!point) throw new Error(`No USA price point for ${BASE_PRICE_USD}`);

  const priceId = '${price0}';
  await ascFetch('/v1/inAppPurchasePriceSchedules', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchasePriceSchedules',
        relationships: {
          inAppPurchase: {data: {type: 'inAppPurchases', id: iapId}},
          baseTerritory: {data: {type: 'territories', id: 'USA'}},
          manualPrices: {data: [{type: 'inAppPurchasePrices', id: priceId}]},
        },
      },
      included: [
        {
          type: 'inAppPurchasePrices',
          id: priceId,
          attributes: {startDate: null},
          relationships: {
            inAppPurchasePricePoint: {data: {type: 'inAppPurchasePricePoints', id: point.id}},
          },
        },
      ],
    }),
  });
  console.log(`price set: USD ${BASE_PRICE_USD} (other territories auto-equalized)`);
}

async function ensureAvailability(iapId) {
  const territories = [];
  let next = '/v1/territories?limit=200';
  while (next) {
    const page = await ascFetch(next);
    territories.push(...page.data.map((t) => ({type: 'territories', id: t.id})));
    next = page.links?.next ? page.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  try {
    await ascFetch('/v1/inAppPurchaseAvailabilities', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'inAppPurchaseAvailabilities',
          attributes: {availableInNewTerritories: true},
          relationships: {
            inAppPurchase: {data: {type: 'inAppPurchases', id: iapId}},
            availableTerritories: {data: territories},
          },
        },
      }),
    });
    console.log(`availability set: ${territories.length} territories`);
  } catch (error) {
    console.log('availability:', error.message);
  }
}

const iapId = await findOrCreateIap();
await ensureLocalizations(iapId);
await ensurePrice(iapId);
await ensureAvailability(iapId);
const iap = await ascFetch(`/v2/inAppPurchases/${iapId}`);
console.log('state:', iap.data.attributes.state);
