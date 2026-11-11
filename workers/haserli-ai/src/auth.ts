// Copied from Tohav (workers/recipe-ai/src/auth.ts).
import { createLocalJWKSet, errors, jwtVerify, type JSONWebKeySet } from 'jose';

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS_CACHE_MS = 60 * 60 * 1000;

/**
 * Google's public signing keys, shared across requests in this isolate. Only
 * resolved data is cached — never a pending promise, because Workers forbid
 * awaiting I/O that another request started (why createRemoteJWKSet isn't used).
 */
let cachedJwks: { keys: JSONWebKeySet; fetchedAt: number } | null = null;

async function getFirebaseJwks(forceRefresh: boolean): Promise<JSONWebKeySet> {
  if (!forceRefresh && cachedJwks && Date.now() - cachedJwks.fetchedAt < JWKS_CACHE_MS) {
    return cachedJwks.keys;
  }
  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) throw new Error(`Firebase JWKS fetch failed [${response.status}]`);
  const keys = await response.json<JSONWebKeySet>();
  cachedJwks = { keys, fetchedAt: Date.now() };
  return keys;
}

/** Verifies a Firebase Auth ID token (anonymous users included) and returns the user's uid. */
export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<string> {
  const verify = async (forceRefresh: boolean) =>
    jwtVerify(token, createLocalJWKSet(await getFirebaseJwks(forceRefresh)), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });

  let result;
  try {
    result = await verify(false);
  } catch (error) {
    // Google rotated its keys since the cache was filled.
    if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
    result = await verify(true);
  }

  const uid = result.payload.sub;
  if (!uid) throw new Error('ID token has no subject');
  return uid;
}
