// A string-keyed KV seam for the local stores.
//
// This module stays free of native imports on purpose. The AsyncStorage binding lives in
// asyncStorageKv.ts, because importing it here dragged the native module into every unit test that
// touches the store, and a test suite that cannot load the store is a test suite that stops being
// run.

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** An in-memory KV for tests: independent state per instance, nothing shared. */
export function memoryKv(seed?: Record<string, string>): KeyValueStore {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    async getItem(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}
