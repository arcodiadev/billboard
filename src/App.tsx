import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BoardClient, ConnectionStatus, Snapshot, StreamHandle } from './types';
import { HubClient } from './client';
import { DemoClient } from './demo';
import { validateHubUrl } from './hubUrl';
import { defaultProbe, describeConnectError } from './connectErrors';
import type { ConnectFailure } from './connectErrors';
import { sortNeedsAttention } from './grouping';
import { TopBar } from './components/TopBar';
import { TokenScreen, DEFAULT_HUB } from './components/TokenScreen';
import { NeedsAttention } from './components/NeedsAttention';
import { AgentsPanel } from './components/AgentsPanel';
import { FeedPanel } from './components/FeedPanel';
import { WallView } from './components/WallView';

const LS_HUB = 'billboard.hub';
const LS_TOKEN = 'billboard.token';

interface BoardState {
  snapshot: Snapshot;
  status: ConnectionStatus;
  lastUpdate: number;
  demo: boolean;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

export function App(): ReactNode {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const freeze = params.get('freeze') === '1';
  const hubParam = params.get('hub');

  const [board, setBoard] = useState<BoardState | null>(null);
  const [wall, setWall] = useState(params.get('wall') === '1');
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [screenHub, setScreenHub] = useState(() => hubParam ?? window.localStorage.getItem(LS_HUB) ?? DEFAULT_HUB);
  const [hubKey, setHubKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const streamRef = useRef<StreamHandle | null>(null);
  const initialFeedRevs = useRef<ReadonlySet<number>>(new Set());

  const attachStream = useCallback((client: BoardClient, snapshot: Snapshot) => {
    streamRef.current?.close();
    initialFeedRevs.current = new Set(snapshot.feed.map((f) => f.rev));
    streamRef.current = client.openStream(snapshot.rev, {
      onAgent(agent) {
        setBoard((b) => {
          if (!b) return b;
          const agents = b.snapshot.agents.some((a) => a.id === agent.id)
            ? b.snapshot.agents.map((a) => (a.id === agent.id ? agent : a))
            : [...b.snapshot.agents, agent];
          return { ...b, snapshot: { ...b.snapshot, agents }, lastUpdate: Date.now() };
        });
      },
      onAgentRemoved(id) {
        setBoard((b) =>
          b
            ? {
                ...b,
                snapshot: { ...b.snapshot, agents: b.snapshot.agents.filter((a) => a.id !== id) },
                lastUpdate: Date.now(),
              }
            : b,
        );
      },
      onAttention(items) {
        setBoard((b) =>
          b
            ? { ...b, snapshot: { ...b.snapshot, needs_attention: sortNeedsAttention(items) }, lastUpdate: Date.now() }
            : b,
        );
      },
      onFeed(line) {
        setBoard((b) =>
          b
            ? { ...b, snapshot: { ...b.snapshot, feed: [line, ...b.snapshot.feed].slice(0, 50) }, lastUpdate: Date.now() }
            : b,
        );
      },
      onSnapshot(snapshot) {
        initialFeedRevs.current = new Set(snapshot.feed.map((f) => f.rev));
        setBoard((b) =>
          b ? { ...b, snapshot: { ...snapshot, needs_attention: sortNeedsAttention(snapshot.needs_attention) }, lastUpdate: Date.now() } : b,
        );
      },
      onStatus(status) {
        setBoard((b) => (b ? { ...b, status, lastUpdate: status === 'live' ? Date.now() : b.lastUpdate } : b));
      },
    });
  }, []);

  const startWith = useCallback(
    async (client: BoardClient, demo: boolean) => {
      const snapshot = await client.getSnapshot();
      const fixed: Snapshot = { ...snapshot, needs_attention: sortNeedsAttention(snapshot.needs_attention) };
      setBoard({ snapshot: fixed, status: 'live', lastUpdate: Date.now(), demo });
      attachStream(client, fixed);
      return fixed;
    },
    [attachStream],
  );

  const startDemo = useCallback(async () => {
    streamRef.current?.close();
    setConnectError(null);
    await startWith(new DemoClient({ freeze }), true);
  }, [freeze, startWith]);

  const connect = useCallback(
    async (hubInput: string, token: string, opts: { save: boolean; fromSaved?: boolean }) => {
      // A saved hub whose address is wrong or unreachable goes back to the
      // default in the hub box, and the message says so. A reached hub (bad
      // token, CORS refusal) keeps its address. A hub the user typed is left alone.
      const showFailure = (failure: ConnectFailure, hubTried: string): void => {
        if (!opts.fromSaved || !failure.resetHub) {
          setConnectError(failure.message);
          return;
        }
        if (hubTried === DEFAULT_HUB) {
          setConnectError(`The saved hub failed. ${failure.message}`);
        } else {
          setConnectError(`The saved hub address ${hubTried} failed. ${failure.message} The hub box now shows ${DEFAULT_HUB}.`);
          setScreenHub(DEFAULT_HUB);
          setHubKey((k) => k + 1);
        }
      };
      const check = validateHubUrl(hubInput);
      if (!check.ok) {
        showFailure({ message: check.error, resetHub: true }, hubInput.trim());
        return;
      }
      const cleanToken = token.replace(/\s/g, '');
      if (!cleanToken) {
        setConnectError('Paste your token first. Create a read-only one with: lectrical token create billboard --team <team> --role read');
        return;
      }
      if (!/^[\x21-\x7e]+$/.test(cleanToken)) {
        setConnectError("That token has characters a header can't carry.");
        return;
      }
      setBusy(true);
      setConnectError(null);
      try {
        const client = new HubClient(check.url, cleanToken);
        streamRef.current?.close();
        const snapshot = await startWith(client, false);
        if (snapshot.view === 'counts') setWall(true);
        if (opts.save) {
          window.localStorage.setItem(LS_HUB, check.url);
          window.localStorage.setItem(LS_TOKEN, cleanToken);
        }
      } catch (err) {
        const failure = await describeConnectError(err, check.url, window.location.origin, defaultProbe);
        showFailure(failure, check.url);
      } finally {
        setBusy(false);
      }
    },
    [startWith],
  );

  // Boot: demo from the URL, else a saved hub + token, else the token screen.
  useEffect(() => {
    if (params.get('demo') === '1') {
      void startDemo();
      return;
    }
    const hub = window.localStorage.getItem(LS_HUB);
    const token = window.localStorage.getItem(LS_TOKEN);
    if (hub && token !== null) void connect(hub, token, { save: false, fromSaved: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticking clock for wait times (frozen in freeze mode for screenshots).
  useEffect(() => {
    if (freeze) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [freeze]);

  // Wall mode class on <body> and URL sync.
  useEffect(() => {
    document.body.classList.toggle('wall', wall && board !== null);
    return () => document.body.classList.remove('wall');
  }, [wall, board]);

  useEffect(() => {
    document.title = board ? `Billboard · ${board.snapshot.team}` : 'Billboard';
  }, [board]);

  useEffect(() => () => streamRef.current?.close(), []);

  function toggleWall(on: boolean): void {
    setWall(on);
    const p = new URLSearchParams(window.location.search);
    if (on) p.set('wall', '1');
    else p.delete('wall');
    const q = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''));
  }

  function disconnect(): void {
    streamRef.current?.close();
    streamRef.current = null;
    window.localStorage.removeItem(LS_HUB);
    window.localStorage.removeItem(LS_TOKEN);
    setBoard(null);
    setConnectError(null);
    toggleWall(false);
  }

  const connected = board !== null;
  const wallActive = wall && connected;
  const displayNow = freeze && connected && board.demo ? Date.parse(board.snapshot.generated_at) : now;

  return (
    <>
      {!wallActive && (
        <TopBar
          team={connected ? board.snapshot.team : null}
          status={connected ? board.status : 'connecting'}
          lastUpdate={connected ? board.lastUpdate : null}
          demo={connected && board.demo}
          wall={wall}
          onToggleWall={toggleWall}
          onDisconnect={disconnect}
        />
      )}
      {wallActive ? (
        <WallView
          snapshot={board.snapshot}
          now={displayNow}
          lastUpdate={board.lastUpdate}
          reconnecting={board.status === 'reconnecting'}
          onExit={() => toggleWall(false)}
          onDisconnect={disconnect}
        />
      ) : (
        <main className="wrap" id="personal">
          {!connected ? (
            <TokenScreen
              key={hubKey}
              initialHub={screenHub}
              busy={busy}
              error={connectError}
              onConnect={(hub, token) => void connect(hub, token, { save: true })}
              onDemo={() => void startDemo()}
            />
          ) : (
            <>
              <AgentsPanel
                agents={board.snapshot.agents}
                peopleCount={board.snapshot.people.length}
                hasLead={board.snapshot.lead_agent !== null}
                now={displayNow}
                onCopyAgentId={(id) => void copyText(id)}
              />
              <div className="right-col">
                <NeedsAttention
                  items={board.snapshot.needs_attention}
                  agents={board.snapshot.agents}
                  now={displayNow}
                />
                <FeedPanel feed={board.snapshot.feed} initialRevs={initialFeedRevs.current} />
              </div>
            </>
          )}
        </main>
      )}
    </>
  );
}
