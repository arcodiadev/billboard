// Typed client for the Billboard API (see API.md). Token is sent only in the
// Authorization: Bearer header — never in a URL, never logged.

import { createSSEParser } from './sse';
import type {
  BoardAgent,
  BoardClient,
  FeedLine,
  NeedsAttentionItem,
  Snapshot,
  StreamHandle,
  StreamHandlers,
} from './types';

export class ApiError extends Error {
  status: number;
  /** 'not-api': the hub answered, but not with board data. */
  reason?: 'not-api';
  constructor(status: number, message: string, reason?: 'not-api') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.reason = reason;
  }
}

export interface HubClientOptions {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Random source for backoff jitter, returns 0..1. */
  random?: () => number;
}

const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30000;

export class HubClient implements BoardClient {
  private readonly hub: string;
  private readonly token: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(hub: string, token: string, opts: HubClientOptions = {}) {
    this.hub = hub.replace(/\/+$/, '');
    this.token = token;
    this.fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = opts.random ?? Math.random;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  async getSnapshot(): Promise<Snapshot> {
    const res = await this.fetchFn(`${this.hub}/api/board/snapshot`, {
      headers: this.authHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(res.status, "This token can't read a team.");
    }
    if (!res.ok) {
      throw new ApiError(res.status, `The hub answered with an error (status ${res.status}).`);
    }
    try {
      const snapshot: unknown = await res.json();
      // Check the board envelope so unrelated JSON is not mistaken for a
      // network failure when the app tries to read its collections.
      if (
        typeof snapshot !== 'object' || snapshot === null ||
        !('rev' in snapshot) || typeof snapshot.rev !== 'number' ||
        !('team' in snapshot) || typeof snapshot.team !== 'string' ||
        !('view' in snapshot) || (snapshot.view !== 'full' && snapshot.view !== 'counts') ||
        !('generated_at' in snapshot) || typeof snapshot.generated_at !== 'string' ||
        !('lead_agent' in snapshot) ||
        !('people' in snapshot) || !Array.isArray(snapshot.people) ||
        !('agents' in snapshot) || !Array.isArray(snapshot.agents) ||
        !('needs_attention' in snapshot) || !Array.isArray(snapshot.needs_attention) ||
        !('feed' in snapshot) || !Array.isArray(snapshot.feed)
      ) {
        throw new Error('Not a board snapshot');
      }
      return snapshot as Snapshot;
    } catch {
      throw new ApiError(res.status, 'The hub answered, but not with board data.', 'not-api');
    }
  }

  openStream(fromRev: number, handlers: StreamHandlers): StreamHandle {
    let closed = false;
    let lastId: number = fromRev;
    let controller: AbortController | null = null;

    const run = async (): Promise<void> => {
      let delay = BACKOFF_START_MS;
      while (!closed) {
        controller = new AbortController();
        try {
          const res = await this.fetchFn(`${this.hub}/api/board/stream`, {
            headers: this.authHeaders({ 'Last-Event-ID': String(lastId) }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            throw new ApiError(res.status, `stream failed with status ${res.status}`);
          }
          handlers.onStatus('live');
          delay = BACKOFF_START_MS;

          const reset = await this.readStream(res.body, handlers, (id) => {
            lastId = id;
          });
          if (reset) {
            // Server told us we are too far behind: refetch the snapshot and
            // reopen from its rev.
            const snapshot = await this.getSnapshot();
            if (closed) return;
            handlers.onSnapshot(snapshot);
            lastId = snapshot.rev;
            continue;
          }
          // Stream ended cleanly: reconnect.
          throw new Error('stream ended');
        } catch (err) {
          if (closed) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          handlers.onStatus('reconnecting');
          const wait = Math.min(delay, BACKOFF_MAX_MS) * (0.5 + this.random());
          await this.sleep(wait);
          delay = Math.min(delay * 2, BACKOFF_MAX_MS);
        }
      }
    };
    void run();

    return {
      close(): void {
        closed = true;
        controller?.abort();
      },
    };
  }

  /** Returns true when a `reset` event arrived. */
  private async readStream(
    body: ReadableStream<Uint8Array>,
    handlers: StreamHandlers,
    setLastId: (id: number) => void,
  ): Promise<boolean> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let sawReset = false;
    const parser = createSSEParser((msg) => {
      if (msg.id !== undefined) {
        const id = Number(msg.id);
        if (Number.isFinite(id)) setLastId(id);
      }
      switch (msg.event) {
        case 'agent':
          handlers.onAgent(JSON.parse(msg.data) as BoardAgent);
          break;
        case 'agent_removed':
          handlers.onAgentRemoved((JSON.parse(msg.data) as { id: string }).id);
          break;
        case 'attention':
          handlers.onAttention(JSON.parse(msg.data) as NeedsAttentionItem[]);
          break;
        case 'feed':
          handlers.onFeed(JSON.parse(msg.data) as FeedLine);
          break;
        case 'reset':
          sawReset = true;
          break;
        case 'ping':
        case 'message':
        default:
          break;
      }
    });
    for (;;) {
      const { done, value } = await reader.read();
      if (sawReset) return true;
      if (done) return false;
      parser.push(decoder.decode(value, { stream: true }));
    }
  }
}
