/**
 * The IndexedDB storage adapter (W0-08; TP v2.0 §15).
 *
 * One adapter serves both runtimes: Node tests pass `fake-indexeddb`'s factory,
 * the browser passes its own `indexedDB`. The factory is injected rather than
 * read from a global because `packages/sim` may not touch the DOM — and because
 * an adapter that reaches for a global cannot be tested against two
 * implementations of the same contract.
 *
 * The structural types below are deliberately minimal: they name exactly the
 * IndexedDB surface this adapter depends on, so what it needs from a host
 * environment is readable in one place instead of implied by a DOM lib.
 */
import { PersistenceError } from "./index.js";
import type { StorageAdapter } from "./index.js";

export interface IdbRequestLike<T> {
  result: T;
  error: { name?: string; message?: string } | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

export interface IdbObjectStoreLike {
  get(key: string): IdbRequestLike<unknown>;
  put(value: unknown, key: string): IdbRequestLike<unknown>;
  add(value: unknown, key: string): IdbRequestLike<unknown>;
  delete(key: string): IdbRequestLike<unknown>;
  getAllKeys(): IdbRequestLike<unknown>;
}

export interface IdbTransactionLike {
  objectStore(name: string): IdbObjectStoreLike;
}

export interface IdbDatabaseLike {
  readonly objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): IdbObjectStoreLike;
  transaction(names: readonly string[] | string, mode: "readonly" | "readwrite"): IdbTransactionLike;
  close(): void;
}

export interface IdbOpenRequestLike extends IdbRequestLike<IdbDatabaseLike> {
  onupgradeneeded: (() => void) | null;
}

export interface IdbFactoryLike {
  open(name: string, version?: number): IdbOpenRequestLike;
}

/** The object stores this build uses (TP v2.0 §15 names the full set). */
export const OBJECT_STORES = ["snapshots", "journal", "results", "careers", "observer", "meta"] as const;
export const DATABASE_VERSION = 1;

function promisify<T>(request: IdbRequestLike<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = (): void => {
      resolve(request.result);
    };
    request.onerror = (): void => {
      const name = request.error?.name ?? "UnknownError";
      const code = name === "ConstraintError" ? "ResultConflict" : "WriteFailed";
      reject(new PersistenceError(code, `${what}: ${name}${request.error?.message === undefined ? "" : ` — ${request.error.message}`}`));
    };
  });
}

/**
 * Open (and, on first use, create) the database. A duplicate `add` surfaces as
 * IndexedDB's `ConstraintError`, which this adapter maps to `ResultConflict` —
 * the same error `MemoryStorage` raises, so exactly-once finalization behaves
 * identically on both.
 */
export async function openDatabase(factory: IdbFactoryLike, name = "lastclan"): Promise<IdbDatabaseLike> {
  const request = factory.open(name, DATABASE_VERSION);
  request.onupgradeneeded = (): void => {
    const db = request.result;
    for (const store of OBJECT_STORES) {
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    }
  };
  return promisify(request, `open database ${name}`);
}

export class IndexedDbStorage implements StorageAdapter {
  readonly #db: IdbDatabaseLike;

  private constructor(db: IdbDatabaseLike) {
    this.#db = db;
  }

  static async open(factory: IdbFactoryLike, name = "lastclan"): Promise<IndexedDbStorage> {
    return new IndexedDbStorage(await openDatabase(factory, name));
  }

  close(): void {
    this.#db.close();
  }

  #store(store: string, mode: "readonly" | "readwrite"): IdbObjectStoreLike {
    if (!OBJECT_STORES.includes(store as (typeof OBJECT_STORES)[number])) {
      throw new PersistenceError("WriteFailed", `unknown object store "${store}"; this build creates ${OBJECT_STORES.join(", ")}`);
    }
    return this.#db.transaction(store, mode).objectStore(store);
  }

  async get(store: string, key: string): Promise<Uint8Array | undefined> {
    const value = await promisify(this.#store(store, "readonly").get(key), `get ${store}/${key}`);
    if (value === undefined || value === null) return undefined;
    return value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
  }

  async put(store: string, key: string, value: Uint8Array): Promise<void> {
    await promisify(this.#store(store, "readwrite").put(value.slice(), key), `put ${store}/${key}`);
  }

  async add(store: string, key: string, value: Uint8Array): Promise<void> {
    await promisify(this.#store(store, "readwrite").add(value.slice(), key), `add ${store}/${key}`);
  }

  async delete(store: string, key: string): Promise<void> {
    await promisify(this.#store(store, "readwrite").delete(key), `delete ${store}/${key}`);
  }

  async keys(store: string): Promise<readonly string[]> {
    const keys = (await promisify(this.#store(store, "readonly").getAllKeys(), `keys ${store}`)) as string[];
    return [...keys].sort();
  }
}
