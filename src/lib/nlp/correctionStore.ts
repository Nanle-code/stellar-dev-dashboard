/**
 * Correction store for the Natural Language Transaction Builder (#551).
 *
 * Satisfies the "system learns from corrections" criterion without a training
 * loop: when a user fixes a parsed field, the mapping is persisted and consulted
 * on every later parse. Correcting "Alice" to a public key once means the next
 * "Send 20 XLM to Alice" resolves without prompting.
 *
 * Backed by idb, which is already a dependency. Falls back to an in-memory map
 * when IndexedDB is unavailable (SSR, private browsing, test runners), so the
 * parser never throws because storage is missing.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { Correction } from "./types";

const DB_NAME = "nl-tx-corrections";
const DB_VERSION = 1;
const STORE = "corrections";

let dbPromise: Promise<IDBPDatabase | null> | null = null;

/** In-memory fallback, also used as a read-through cache. */
const memoryStore = new Map<string, Correction>();
let memoryOnly = false;

function correctionId(key: string, kind: Correction["kind"]): string {
  return `${kind}:${key.toLowerCase()}`;
}

function getDb(): Promise<IDBPDatabase | null> {
  if (memoryOnly) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    if (typeof indexedDB === "undefined") {
      memoryOnly = true;
      return null;
    }
    try {
      return await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("kind", "kind");
            store.createIndex("key", "key");
          }
        },
      });
    } catch {
      memoryOnly = true;
      return null;
    }
  })();

  return dbPromise;
}

/** Loads every stored correction. Safe to call on each parse. */
export async function loadCorrections(): Promise<Correction[]> {
  const db = await getDb();
  if (!db) return Array.from(memoryStore.values());

  try {
    const all = (await db.getAll(STORE)) as Correction[];
    all.forEach((c) => memoryStore.set(c.id, c));
    return all;
  } catch {
    return Array.from(memoryStore.values());
  }
}

/**
 * Records a correction. Repeating the same correction increments its hit count,
 * which is how the parser breaks ties between conflicting mappings.
 */
export async function recordCorrection(
  key: string,
  kind: Correction["kind"],
  value: string,
): Promise<Correction> {
  const trimmedKey = key.trim().toLowerCase();
  const trimmedValue = value.trim();

  if (!trimmedKey || !trimmedValue) {
    throw new Error("Correction key and value are both required.");
  }

  const id = correctionId(trimmedKey, kind);
  const existing = memoryStore.get(id) ?? (await readOne(id));

  const record: Correction = {
    id,
    key: trimmedKey,
    kind,
    value: trimmedValue,
    hits: existing && existing.value === trimmedValue ? existing.hits + 1 : 1,
    updatedAt: Date.now(),
  };

  memoryStore.set(id, record);

  const db = await getDb();
  if (db) {
    try {
      await db.put(STORE, record);
    } catch {
      // Persisted copy is best-effort; the in-memory copy still applies.
    }
  }

  return record;
}

async function readOne(id: string): Promise<Correction | undefined> {
  const db = await getDb();
  if (!db) return memoryStore.get(id);
  try {
    return (await db.get(STORE, id)) as Correction | undefined;
  } catch {
    return memoryStore.get(id);
  }
}

/** Removes a single correction. */
export async function forgetCorrection(
  key: string,
  kind: Correction["kind"],
): Promise<void> {
  const id = correctionId(key, kind);
  memoryStore.delete(id);
  const db = await getDb();
  if (db) {
    try {
      await db.delete(STORE, id);
    } catch {
      // Nothing further to do; the in-memory copy is already gone.
    }
  }
}

/** Clears every correction. Exposed so the UI can offer a reset. */
export async function clearCorrections(): Promise<void> {
  memoryStore.clear();
  const db = await getDb();
  if (db) {
    try {
      await db.clear(STORE);
    } catch {
      // In-memory state is already cleared.
    }
  }
}

/**
 * Compares the operations a user confirmed against what was parsed and records
 * a correction for each field the user changed. Called on confirm, so learning
 * happens without the user doing anything extra.
 */
export async function learnFromConfirmation(
  parsedOps: Array<{ params: Record<string, unknown> }>,
  confirmedOps: Array<{ params: Record<string, unknown> }>,
): Promise<Correction[]> {
  const learned: Correction[] = [];

  for (let i = 0; i < confirmedOps.length; i += 1) {
    const parsed = parsedOps[i]?.params ?? {};
    const confirmed = confirmedOps[i]?.params ?? {};

    const alias = String(parsed.destinationRaw ?? "").trim();
    const finalDestination = String(confirmed.destination ?? confirmed.from ?? confirmed.sponsoredId ?? "").trim();

    if (alias && finalDestination && alias.toLowerCase() !== finalDestination.toLowerCase()) {
      learned.push(await recordCorrection(alias, "destination", finalDestination));
    }

    const code = String(confirmed.assetCode ?? parsed.assetCode ?? "").trim();
    const issuer = String(confirmed.assetIssuer ?? "").trim();
    const parsedIssuer = String(parsed.assetIssuer ?? "").trim();

    if (code && issuer && issuer !== parsedIssuer) {
      learned.push(await recordCorrection(code, "issuer", issuer));
    }
  }

  return learned;
}

/** Test seam: injects corrections without touching IndexedDB. */
export function __seedMemoryCorrections(corrections: Correction[]): void {
  memoryOnly = true;
  memoryStore.clear();
  corrections.forEach((c) => memoryStore.set(c.id, c));
}