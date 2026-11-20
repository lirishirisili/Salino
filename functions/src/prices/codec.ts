/** Unsigned LEB128 varints: compact, gzip-friendly storage for sorted index/price columns. */
export function encodeVarints(values: ArrayLike<number>): Buffer {
  const out = Buffer.allocUnsafe(values.length * 5);
  let pos = 0;
  for (let k = 0; k < values.length; k++) {
    let v = values[k] >>> 0;
    while (v >= 0x80) {
      out[pos++] = (v & 0x7f) | 0x80;
      v >>>= 7;
    }
    out[pos++] = v;
  }
  return out.subarray(0, pos);
}

export function decodeVarints(buf: Buffer, count: number, offset = 0): { values: Int32Array; end: number } {
  const values = new Int32Array(count);
  let pos = offset;
  for (let k = 0; k < count; k++) {
    let v = 0;
    let shift = 0;
    let b: number;
    do {
      b = buf[pos++];
      v |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    values[k] = v >>> 0;
  }
  return { values, end: pos };
}

/** Packs a store's sorted item indices and prices (agorot) as base64 of delta-indices then prices. */
export function packPriceGroup(indices: ArrayLike<number>, agorot: ArrayLike<number>): { n: number; d: string } {
  const deltas = new Int32Array(indices.length);
  let prev = 0;
  for (let k = 0; k < indices.length; k++) {
    deltas[k] = indices[k] - prev;
    prev = indices[k];
  }
  return { n: indices.length, d: Buffer.concat([encodeVarints(deltas), encodeVarints(agorot)]).toString("base64") };
}

export function unpackPriceGroup(group: { n: number; d: string }): { idx: Int32Array; price: Int32Array } {
  const buf = Buffer.from(group.d, "base64");
  const { values: idx, end } = decodeVarints(buf, group.n, 0);
  for (let k = 1; k < idx.length; k++) idx[k] += idx[k - 1];
  const { values: price } = decodeVarints(buf, group.n, end);
  return { idx, price };
}
