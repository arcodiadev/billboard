import { describe, expect, it, vi } from 'vitest';
import { HubClient } from '../src/client';
import { buildDemoSnapshot, FREEZE_BASE } from '../src/demo';
import type { StreamHandlers } from '../src/types';

const TOKEN = 'lck_test_token_0000000000000000'; // fake token, tests only

function streamResponse(text: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

function neverResponse(): Promise<Response> {
  return new Promise<Response>(() => {});
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function noopHandlers(overrides: Partial<StreamHandlers> = {}): StreamHandlers {
  return {
    onAgent: () => {},
    onAgentRemoved: () => {},
    onAttention: () => {},
    onFeed: () => {},
    onSnapshot: () => {},
    onStatus: () => {},
    ...overrides,
  };
}

async function flush(times = 30): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('HubClient', () => {
  it('sends the token only in the Authorization header, never in the URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(buildDemoSnapshot(FREEZE_BASE)));
    const client = new HubClient('https://hub.example.com', TOKEN, { fetchFn });
    await client.getSnapshot();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hub.example.com/api/board/snapshot');
    expect(url).not.toContain(TOKEN);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(Object.keys(headers)).toEqual(['Authorization']);
  });

  it('maps 401/403 to a plain-English error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 403));
    const client = new HubClient('https://hub.example.com', TOKEN, { fetchFn });
    await expect(client.getSnapshot()).rejects.toThrow("This token can't read a team.");
  });

  it.each([null, {}, [], { rev: 1 }, { ...buildDemoSnapshot(FREEZE_BASE), needs_attention: null }])(
    'classifies a non-board JSON response as not-API: %j',
    async (body) => {
      const fetchFn = vi.fn().mockResolvedValue(Response.json(body));
      const client = new HubClient('https://hub.example.com', TOKEN, { fetchFn });
      await expect(client.getSnapshot()).rejects.toMatchObject({ status: 200, reason: 'not-api' });
    },
  );

  it('classifies an HTML response as not-API', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>Wrong site</html>'));
    const client = new HubClient('https://hub.example.com', TOKEN, { fetchFn });
    await expect(client.getSnapshot()).rejects.toMatchObject({ status: 200, reason: 'not-api' });
  });

  it('sends Last-Event-ID with the last seen id when reconnecting', async () => {
    const seenLastEventIds: string[] = [];
    const fetchFn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (url.endsWith('/api/board/stream')) {
        seenLastEventIds.push(headers['Last-Event-ID'] ?? '');
        if (seenLastEventIds.length === 1) {
          // First stream: one event with id 50, then the connection drops.
          return Promise.resolve(streamResponse('id: 50\nevent: ping\ndata: {}\n\n'));
        }
        return neverResponse(); // second stream stays open
      }
      return Promise.resolve(jsonResponse(buildDemoSnapshot(FREEZE_BASE)));
    });
    const statuses: string[] = [];
    const client = new HubClient('https://hub.example.com', TOKEN, {
      fetchFn,
      sleep: () => Promise.resolve(),
      random: () => 0.5,
    });
    const handle = client.openStream(42, noopHandlers({ onStatus: (s) => statuses.push(s) }));
    await flush();
    expect(seenLastEventIds).toEqual(['42', '50']);
    expect(statuses).toContain('live');
    expect(statuses).toContain('reconnecting');
    handle.close();
  });

  it('on a reset event refetches the snapshot and reopens from its rev', async () => {
    const snapshot = { ...buildDemoSnapshot(FREEZE_BASE), rev: 42494 };
    const calls: { url: string; lastEventId?: string }[] = [];
    let streamCount = 0;
    const fetchFn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (url.endsWith('/api/board/stream')) {
        streamCount += 1;
        calls.push({ url, lastEventId: headers['Last-Event-ID'] });
        if (streamCount === 1) {
          return Promise.resolve(streamResponse('event: reset\ndata: {"reason":"too_far_behind"}\n\n'));
        }
        return neverResponse();
      }
      if (url.endsWith('/api/board/snapshot')) {
        calls.push({ url });
        return Promise.resolve(jsonResponse(snapshot));
      }
      return Promise.reject(new Error('unexpected url'));
    });
    const snapshots: unknown[] = [];
    const client = new HubClient('https://hub.example.com', TOKEN, {
      fetchFn,
      sleep: () => Promise.resolve(),
      random: () => 0.5,
    });
    const handle = client.openStream(7, noopHandlers({ onSnapshot: (s) => snapshots.push(s) }));
    await flush();
    expect(snapshots).toEqual([snapshot]);
    expect(calls).toEqual([
      { url: 'https://hub.example.com/api/board/stream', lastEventId: '7' },
      { url: 'https://hub.example.com/api/board/snapshot' },
      { url: 'https://hub.example.com/api/board/stream', lastEventId: '42494' },
    ]);
    handle.close();
  });

  it('delivers stream events to the handlers', async () => {
    const agent = { id: 'codex|x', name: 'coder-2', state: 'working' };
    let streamCount = 0;
    const fetchFn = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/board/stream')) {
        streamCount += 1;
        if (streamCount > 1) return neverResponse();
        return Promise.resolve(
          streamResponse(
            'id: 51\nevent: agent\ndata: ' +
              JSON.stringify(agent) +
              '\n\n' +
              'id: 52\nevent: feed\ndata: {"rev":52,"at":"2026-01-01T00:00:00Z","agent_id":"codex|x","name":"coder-2","text":"did a thing"}\n\n',
          ),
        );
      }
      return neverResponse();
    });
    const agents: unknown[] = [];
    const feeds: unknown[] = [];
    const client = new HubClient('https://hub.example.com', TOKEN, { fetchFn, sleep: () => Promise.resolve() });
    const handle = client.openStream(
      50,
      noopHandlers({ onAgent: (a) => agents.push(a), onFeed: (f) => feeds.push(f) }),
    );
    await flush();
    expect(agents).toEqual([agent]);
    expect(feeds).toHaveLength(1);
    handle.close();
  });
});
