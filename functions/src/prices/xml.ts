import { gunzipSync, inflateRawSync } from "node:zlib";

/** Chains publish gzip, single-entry zip, or plain XML under the same extensions. */
export function decompress(buf: Buffer): Buffer {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return gunzipSync(buf);
  if (buf.length >= 30 && buf[0] === 0x50 && buf[1] === 0x4b) return unzipFirstEntry(buf);
  return buf;
}

function unzipFirstEntry(buf: Buffer): Buffer {
  const method = buf.readUInt16LE(8);
  let compSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  if (compSize === 0) {
    // Sizes live in the central directory when bit 3 (data descriptor) is set.
    const cd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (cd < 0) throw new Error("zip: central directory not found");
    compSize = buf.readUInt32LE(cd + 20);
  }
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error(`zip: unsupported method ${method}`);
}

export function decodeText(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  const head = buf.subarray(0, 200).toString("latin1");
  const declared = /encoding=["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase();
  if (declared && /1255|8859-8|hebrew/.test(declared)) {
    return new TextDecoder("windows-1255").decode(buf);
  }
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}

/** Yields the inner text of every `<tag>…</tag>` element (case-insensitive, non-nested). */
export function* blocks(xml: string, tag: string): Generator<string> {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) yield m[1];
}

/** Leaf `<Name>value</Name>` pairs, keys lower-cased; the first occurrence wins. */
export function fields(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<([A-Za-z_][\w.-]*)\s*>([^<]*)<\/\1\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(m[2]).trim();
  }
  return out;
}

/** All values of a leaf tag inside a block, in document order. */
export function allValues(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\s*>([^<]*)</${tag}\\s*>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.push(decodeEntities(m[1]).trim());
  return out;
}

export function headerField(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}\\s*>([^<]*)</${tag}\\s*>`, "i");
  return decodeEntities(re.exec(xml.slice(0, 4000))?.[1] ?? "").trim();
}

export function num(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
