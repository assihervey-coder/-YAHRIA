// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Canonical Serialization Substrate (Domain 00.9)
// Doc ID: YAHRIA-KRN-014 | R8 Supremacy Pack
//
// Every sealable structure in the Supremacy Pack (proof certificates,
// Merkle bundles, attestations, timelines) is serialized through this
// module so that hashing is canonical, stable, and cross-runtime
// reproducible (TS ⇄ Python — INV-191).
//
// canonicalJson rules:
//   1. Object keys sorted lexicographically (UTF-16 code units), recursively.
//   2. Arrays keep their order (order is semantic).
//   3. No whitespace between tokens.
//   4. undefined-valued object entries are dropped (like JSON.stringify).
//   5. Numbers serialized by ECMAScript Number::toString (JSON.stringify).
// ═══════════════════════════════════════════════════════════════

import { createHash, createHmac } from 'crypto';

export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(v: unknown): string {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') {
    return JSON.stringify(v);
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) {
    return '[' + v.map((x) => serialize(x === undefined ? null : x)).join(',') + ']';
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return '{' + keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`).join(',') + '}';
  }
  // functions, symbols, bigint → dropped deterministically
  return 'null';
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256Canonical(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function hmacSha256Hex(key: string, value: unknown): string {
  return createHmac('sha256', key).update(canonicalJson(value)).digest('hex');
}

/** Fixed-length deterministic id from a namespace + payload (test-sealed contexts). */
export function deterministicUid(namespace: string, value: unknown): string {
  const h = sha256Canonical(value);
  return `${namespace}-${h.slice(0, 12).toUpperCase()}`;
}
