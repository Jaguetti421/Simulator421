/**
 * Barrel for the persistence module: the container and stores, the world
 * snapshot format, and the IndexedDB adapter. `index.ts` stays the place the
 * other two import from, so this file adds a public surface without creating a
 * cycle.
 */
export * from "./index.js";
export * from "./snapshot.js";
export * from "./indexeddb.js";
