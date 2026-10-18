import { useState } from 'react';
import type { ReactNode } from 'react';

export const DEFAULT_HUB = 'https://hub.lectrical.dev';
export const LOCAL_HUB = 'http://127.0.0.1:8800';

interface TokenScreenProps {
  initialHub: string;
  busy: boolean;
  error: string | null;
  onConnect(hub: string, token: string): void;
  onDemo(): void;
}

export function TokenScreen({ initialHub, busy, error, onConnect, onDemo }: TokenScreenProps): ReactNode {
  const [hub, setHub] = useState(initialHub);
  const [token, setToken] = useState('');

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    onConnect(hub, token);
  }

  return (
    <section className="token-screen" aria-label="Connect your token">
      <form className="token-card" onSubmit={submit}>
        <h1>Connect Billboard to Lectrical</h1>
        <div className="label-row">
          <label htmlFor="hub">Hub address</label>
          <button className="hub-local" type="button" onClick={() => setHub(LOCAL_HUB)}>
            Local hub (127.0.0.1:8800)
          </button>
        </div>
        <input
          id="hub"
          type="text"
          inputMode="url"
          value={hub}
          onChange={(e) => setHub(e.target.value)}
          placeholder={DEFAULT_HUB}
          autoComplete="off"
          spellCheck={false}
        />
        <label htmlFor="tok">Paste your Lectrical token</label>
        <input
          id="tok"
          type="password"
          placeholder="lck_live_…"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <p>Stored only in this browser. Use a read-only token.</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="connect" type="submit" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
        <a
          className="demo-link"
          href="?demo=1"
          onClick={(e) => {
            e.preventDefault();
            onDemo();
          }}
        >
          Try with demo data
        </a>
      </form>
    </section>
  );
}
