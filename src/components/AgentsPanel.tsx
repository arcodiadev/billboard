import type { ReactNode } from 'react';
import type { BoardAgent } from '../types';
import { STATE_CLASS, STATE_LABEL } from '../types';
import { groupAgentsByState } from '../grouping';
import { formatDuration, secondsBetween } from '../format';
import { DotsMenu } from './DotsMenu';

interface AgentsPanelProps {
  agents: BoardAgent[];
  peopleCount: number;
  hasLead: boolean;
  now: number;
  onCopyAgentId(id: string): void;
}

function toolLine(agent: BoardAgent): string {
  if (agent.is_lead) return `${agent.tool} · team lead`;
  if (agent.owner) return `${agent.tool} · ${agent.owner}`;
  return agent.tool;
}

function AgentRow({ agent, now, onCopyAgentId }: { agent: BoardAgent; now: number; onCopyAgentId(id: string): void }): ReactNode {
  const pct = agent.context_pct;
  const hot = pct !== null && pct >= 90;
  return (
    <div className="agent">
      <span className="a-state">
        <i aria-hidden="true" />
        {STATE_LABEL[agent.state]}
      </span>
      <div className="a-main">
        <div className="a-top">
          <span className="a-name">{agent.name}</span>
          {agent.labels.map((l) => (
            <span className="chip" key={l}>
              {l}
            </span>
          ))}
          <span className="a-tool">{toolLine(agent)}</span>
        </div>
        {agent.task && <div className="a-task">{agent.task}</div>}
      </div>
      <div className="a-meta">
        <span className="a-time">{formatDuration(secondsBetween(agent.state_since, now))}</span>
        {pct !== null && (
          <span className={hot ? 'a-ctx hot' : 'a-ctx'}>
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="pct">{pct}%</span>
          </span>
        )}
        <DotsMenu
          label={`Actions for agent ${agent.name}`}
          items={[{ label: 'Copy agent id', onSelect: () => onCopyAgentId(agent.id) }]}
          announce={() => 'Agent id copied'}
        />
      </div>
    </div>
  );
}

export function AgentsPanel({ agents, peopleCount, hasLead, now, onCopyAgentId }: AgentsPanelProps): ReactNode {
  const groups = groupAgentsByState(agents);
  return (
    <section className="panel agents-panel" aria-labelledby="h-agents">
      <div className="panel-head">
        <h2 id="h-agents">Agents</h2>
        <span className="count">
          {agents.length} agents · {peopleCount} people{hasLead ? ' + lead' : ''}
        </span>
      </div>
      {groups.map((group) => (
        <div className={`group ${STATE_CLASS[group.state]}`} key={group.state}>
          <div className="group-head">
            <span className="g-dot" aria-hidden="true" />
            {STATE_LABEL[group.state]} <span className="g-n">{group.agents.length}</span>
          </div>
          {group.agents.map((agent) => (
            <AgentRow agent={agent} key={agent.id} now={now} onCopyAgentId={onCopyAgentId} />
          ))}
        </div>
      ))}
    </section>
  );
}
