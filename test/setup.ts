import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// vitest's jsdom environment does not expose window.localStorage (jsdom has
// it, but it is an accessor that the global population step drops). Shim it
// with an in-memory Storage for the app under test.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>();
    get length(): number {
      return this.map.size;
    }
    clear(): void {
      this.map.clear();
    }
    getItem(key: string): string | null {
      return this.map.has(key) ? (this.map.get(key) as string) : null;
    }
    key(index: number): string | null {
      return [...this.map.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.map.delete(key);
    }
    setItem(key: string, value: string): void {
      this.map.set(key, String(value));
    }
  }
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
}
