import type { ReactNode } from 'react';
import type { ConnectionStatus } from '../types';
import { formatTimeHMS } from '../format';
import { DotsMenu } from './DotsMenu';

interface TopBarProps {
  /** Null on the first-run token screen: no team, no Live before connecting. */
  team: string | null;
  status: ConnectionStatus;
  lastUpdate: number | null;
  demo: boolean;
  wall: boolean;
  onToggleWall(on: boolean): void;
  onDisconnect(): void;
}

export function TopBar({ team, status, lastUpdate, demo, wall, onToggleWall, onDisconnect }: TopBarProps): ReactNode {
  const connected = team !== null;
  return (
    <header className="topbar">
      <span className="wordmark">
        Billboard<span className="dot">.</span>
      </span>
      {connected && <span className="team-tag">team: {team}</span>}
      {connected &&
        (status === 'reconnecting' ? (
          <span className="live">
            <span className="pulse down" aria-hidden="true" />
            Reconnecting…
          </span>
        ) : (
          <span className="live">
            <span className="pulse" aria-hidden="true" />
            Live{' '}
            <span className="upd">
              {lastUpdate ? `updated ${formatTimeHMS(new Date(lastUpdate))}` : 'updated --:--:--'}
            </span>
          </span>
        ))}
      {connected && <span className="live-note">Reconnects and catches up automatically</span>}
      <div className="top-right">
        {connected && <span className="ro-tag">{demo ? 'Read-only · demo data' : 'Read-only'}</span>}
        <button
          className="switch"
          type="button"
          role="switch"
          aria-checked={wall}
          onClick={() => onToggleWall(!wall)}
        >
          <span className="lbl">Wall mode</span>
          <span className="trk" aria-hidden="true" />
        </button>
        {connected && (
          <DotsMenu
            label="Billboard menu"
            items={[{ label: 'Disconnect and forget token', onSelect: onDisconnect }]}
          />
        )}
      </div>
    </header>
  );
}
