import type { ReactNode } from 'react';
import type { Snapshot } from '../types';
import { STATE_CLASS, STATE_LABEL, STATE_ORDER } from '../types';
import { buildWallRows, longestWaitSeconds } from '../grouping';
import { formatClock, formatTimeHMS } from '../format';
import { DotsMenu } from './DotsMenu';

interface WallViewProps {
  snapshot: Snapshot;
  now: number;
  lastUpdate: number | null;
  reconnecting: boolean;
  onExit(): void;
  onDisconnect(): void;
}

/**
 * Wall mode: one row per person plus a lead-agent row. Renders counts, agent
 * names and wait clocks only — never task, reason, label or feed text, even
 * with a full token.
 */
export function WallView({ snapshot, now, lastUpdate, reconnecting, onExit, onDisconnect }: WallViewProps): ReactNode {
  const rows = buildWallRows(snapshot);
  return (
    <main className="wall-view" aria-label="Wall mode">
      <div className="wall-top">
        <span className="wm">
          Billboard<span className="dot">.</span>
        </span>
        <span className="tm">team: {snapshot.team}</span>
        {reconnecting ? (
          <span className="live">
            <span className="pulse down" aria-hidden="true" />
            Reconnecting…
          </span>
        ) : (
          <span className="live">
            <span className="pulse" aria-hidden="true" />
            Live <span className="upd">{lastUpdate ? formatTimeHMS(new Date(lastUpdate)) : '--:--:--'}</span>
          </span>
        )}
        <DotsMenu label="Billboard menu" items={[{ label: 'Disconnect and forget token', onSelect: onDisconnect }]} />
        <button className="wall-exit" type="button" onClick={onExit}>
          Exit wall mode
        </button>
      </div>
      <div className="wall-rows">
        {rows.map((row) => {
          const wait = longestWaitSeconds(row.agents, now);
          return (
            <section className="wrow" key={row.label} aria-label={row.label}>
              <div>
                <div className="p-name">{row.label}</div>
                <div className="p-sub">
                  {row.agents.length} agent{row.agents.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="wcounts">
                {STATE_ORDER.map((state) => {
                  const n = row.agents.filter((a) => a.state === state).length;
                  return (
                    <div className={`wcount ${STATE_CLASS[state]}${n === 0 ? ' zero' : ''}`} key={state}>
                      <b>{n}</b>
                      <span>{state === 'out_of_memory' ? 'Out of mem' : STATE_LABEL[state]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="wdots">
                {row.agents.map((a) => (
                  <span className={`wdot ${STATE_CLASS[a.state]}`} key={a.id}>
                    <i aria-hidden="true" />
                    <small>{a.name}</small>
                  </span>
                ))}
              </div>
              <div className="wwait">
                {wait === null ? <span className="none">—</span> : <span className="clock">{formatClock(wait)}</span>}
                <span>Longest wait</span>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
