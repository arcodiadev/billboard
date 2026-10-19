import { afterEach, expect, it, vi } from 'vitest';
import { HubClient } from '../src/client';

afterEach(() => vi.unstubAllGlobals());

it('calls the default fetch without binding it to HubClient', async () => {
  const snapshot = { rev: 1 };
  const fetchFn = vi.fn(function (this: unknown) {
    if (this !== undefined && this !== globalThis) {
      throw new TypeError('Illegal invocation');
    }
    return Promise.resolve(Response.json(snapshot));
  });
  vi.stubGlobal('fetch', fetchFn);

  const client = new HubClient('https://hub.example.com', '');
  await expect(client.getSnapshot()).resolves.toEqual(snapshot);
  expect(fetchFn).toHaveBeenCalledTimes(1);
});
