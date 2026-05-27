import "@testing-library/jest-dom/vitest";

// Node 22's experimental localStorage conflicts with happy-dom.
// Provide a working in-memory implementation.
const store = new Map<string, string>();
const storage: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};

Object.defineProperty(window, "localStorage", { value: storage, writable: true });
Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true });
