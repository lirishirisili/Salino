/**
 * Create the one-time "Remove ads" product (haserli_remove_ads) on Google Play
 * with the one-time products API (the legacy inappproducts API is retired):
 * USD 4.99 converted to every region by Play, en-US + iw-IL text, and one
 * backwards-compatible "buy" purchase option, activated. Safe to re-run.
 *
 * Needs a build with com.android.vending.BILLING uploaded to any track first.
 * Usage: node scripts/create-remove-ads-play.mjs
 */
import {createRequire} from 'node:module';
import {
  loadStoreSecrets,
  requireStoreSecret,
} from 'file:///C:/Users/liron/.cursor/skills/store-publish/scripts/load-store-secrets.mjs';

// A googleapis new enough for the one-time products API (Keepsi has one), not a dependency of this app.
const {google} = createRequire('C:/Users/liron/Keepsi/package.json')('googleapis');

const PACKAGE_NAME = 'com.salino.sali';
const PRODUCT_ID = 'haserli_remove_ads';
const PURCHASE_OPTION_ID = 'buy';
const USD_PRICE = {currencyCode: 'USD', units: '4', nanos: 990_000_000};

const LISTINGS = [
  {
    languageCode: 'en-US',
    title: 'Remove ads',
    description: 'One-time purchase. Removes every ad from Haserli for good.',
  },
  {
    languageCode: 'iw-IL',
    title: 'הסרת פרסומות',
    description: 'רכישה חד־פעמית. מסירה את כל הפרסומות מחסרלי לתמיד.',
  },
];

const secrets = loadStoreSecrets();
const auth = new google.auth.GoogleAuth({
  keyFile: requireStoreSecret(secrets, 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({version: 'v3', auth});
const products = publisher.monetization.onetimeproducts;

const {data: converted} = await publisher.monetization.convertRegionPrices({
  packageName: PACKAGE_NAME,
  requestBody: {price: USD_PRICE},
});
// Israel gets a round shekel price instead of the converted one.
const ILS_PRICE = {currencyCode: 'ILS', units: '16', nanos: 900_000_000};
const regionalConfigs = Object.values(converted.convertedRegionPrices ?? {}).map(region => ({
  regionCode: region.regionCode,
  price: region.regionCode === 'IL' ? ILS_PRICE : region.price,
  availability: 'AVAILABLE',
}));
console.log(`converted USD 4.99 into ${regionalConfigs.length} regions (version ${converted.regionVersion?.version})`);

const {data: product} = await products.patch({
  packageName: PACKAGE_NAME,
  productId: PRODUCT_ID,
  allowMissing: true,
  updateMask: 'listings,purchaseOptions',
  'regionsVersion.version': converted.regionVersion?.version,
  requestBody: {
    packageName: PACKAGE_NAME,
    productId: PRODUCT_ID,
    listings: LISTINGS,
    purchaseOptions: [
      {
        purchaseOptionId: PURCHASE_OPTION_ID,
        buyOption: {legacyCompatible: true, multiQuantityEnabled: false},
        regionalPricingAndAvailabilityConfigs: regionalConfigs,
        newRegionsConfig: {
          availability: 'AVAILABLE',
          usdPrice: converted.convertedOtherRegionsPrice?.usdPrice ?? USD_PRICE,
          eurPrice: converted.convertedOtherRegionsPrice?.eurPrice,
        },
      },
    ],
  },
});
console.log('product saved:', product.productId, 'option state:', product.purchaseOptions?.[0]?.state);

if (product.purchaseOptions?.[0]?.state !== 'ACTIVE') {
  const {data: activated} = await products.purchaseOptions.batchUpdateStates({
    packageName: PACKAGE_NAME,
    productId: PRODUCT_ID,
    requestBody: {
      requests: [
        {
          activatePurchaseOptionRequest: {
            packageName: PACKAGE_NAME,
            productId: PRODUCT_ID,
            purchaseOptionId: PURCHASE_OPTION_ID,
          },
        },
      ],
    },
  });
  console.log('activated:', activated.oneTimeProducts?.[0]?.purchaseOptions?.[0]?.state);
}

const {data: check} = await products.get({packageName: PACKAGE_NAME, productId: PRODUCT_ID});
const us = check.purchaseOptions?.[0]?.regionalPricingAndAvailabilityConfigs?.find(c => c.regionCode === 'US');
const il = check.purchaseOptions?.[0]?.regionalPricingAndAvailabilityConfigs?.find(c => c.regionCode === 'IL');
console.log('final:', check.productId, check.purchaseOptions?.[0]?.state, 'US', us?.price, 'IL', il?.price);
