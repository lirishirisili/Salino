/** Agorot → "₪12.90". */
export function formatShekel(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
}

/** "רמי לוי · תלפיות" — without repeating the chain when the branch name already has it. */
export function storeTitle(chainName: string, storeName: string): string {
  const name = storeName.trim();
  if (!name) return chainName;
  if (name.includes(chainName)) return name;
  return `${chainName} · ${name}`;
}

export function formatDistance(km: number | null, units: { km: string; m: string }): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} ${units.m}`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} ${units.km}`;
}

/** Price-file stamp "yyyymmddhhmmss" (Israel time) → "19/11 06:00". */
export function formatStamp(stamp: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(stamp);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : '';
}

/** How much of an item a line covers: "×2" for packages, "0.5 ק״ג" for weighed produce. */
export function formatAmount(amount: number, weighted: boolean, kgLabel: string): string {
  if (weighted) return `${Number.isInteger(amount) ? amount : amount.toFixed(amount < 1 ? 2 : 1)} ${kgLabel}`;
  return `×${amount}`;
}
