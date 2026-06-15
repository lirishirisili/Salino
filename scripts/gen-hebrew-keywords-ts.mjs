import fs from 'fs';

const src = fs.readFileSync(
  'app/src/main/java/com/salino/sali/data/service/IsraeliHebrewCategoryKeywords.kt',
  'utf8'
);
const cats = [
  'DAIRY',
  'BAKERY',
  'FRUITS',
  'VEGETABLES',
  'MEAT_FISH',
  'CLEANING',
  'PANTRY',
  'SNACKS',
  'BEVERAGES',
  'PHARMACY',
];
const map = {};
for (const c of cats) {
  const re = new RegExp(`private val ${c} = listOf\\(([\\s\\S]*?)\\n    \\)`, 'm');
  const m = src.match(re);
  if (!m) {
    console.error('missing', c);
    process.exit(1);
  }
  map[c] = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
let out = "import type { ItemCategory } from '../types';\n\n";
out += 'export const ISRAELI_HEBREW_KEYWORDS: Partial<Record<ItemCategory, string[]>> = {\n';
for (const [k, v] of Object.entries(map)) {
  out += `  ${k}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')},\n`;
}
out += '};\n';
const targets = [
  'web/src/services/israeliHebrewKeywordsData.ts',
  'mobile/src/services/israeliHebrewKeywordsData.ts',
];
for (const target of targets) {
  fs.writeFileSync(target, out);
}
console.log(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.length])));
