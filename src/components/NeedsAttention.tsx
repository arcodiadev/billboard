import type { ReactNode } from 'react';
import type { BoardAgent, NeedsAttentionItem } from '../types';
import { formatClock, secondsBetween } from '../format';

interface NeedsAttentionProps {
  items: NeedsAttentionItem[];
  agents: BoardAgent[];
  now: number;
}

function waitingOnText(item: NeedsAttentionItem): string {
  if (!item.waiting_on) return 'Waiting';
  if (item.waiting_on.kind === 'lead_agent') return 'Waiting on the lead agent';
  return `Waiting on ${item.waiting_on.name}`;
}

export function NeedsAttention({ items, agents, now }: NeedsAttentionProps): ReactNode {
  const ownerOf = new Map(agents.map((a) => [a.id, a.owner] as const));
  return (
    <section className="panel need-panel" aria-labelledby="h-need">
      <div className="panel-head">
        <h2 id="h-need">Needs attention</h2>
        <span className="count">{items.length} waiting · longest first</span>
        <span className="hint">Waiting on a person or on the lead agent</span>
      </div>
      {items.map((item) => {
        const owner = ownerOf.get(item.agent_id) ?? null;
        return (
          <div className="need" key={item.agent_id}>
            <div className="n-who">
              <div className="n-line1">
                <span className="n-name">{item.name}</span>
                {item.labels.map((l) => (
                  <span className="chip" key={l}>
                    {l}
                  </span>
                ))}
                <span className="a-tool">
                  {item.tool}
                  {owner ? ` · ${owner}` : ''}
                </span>
              </div>
              {item.reason && <div className="n-reason">{item.reason}</div>}
              <div className="n-on">{waitingOnText(item)}</div>
            </div>
            <span className="clock">{formatClock(secondsBetween(item.since, now))}</span>
          </div>
        );
      })}
    </section>
  );
}
