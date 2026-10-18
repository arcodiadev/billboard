import { describe, expect, it } from 'vitest';
import { groupAgentsByState, sortNeedsAttention, buildWallRows, longestWaitSeconds } from '../src/grouping';
import { buildDemoSnapshot, FREEZE_BASE } from '../src/demo';
import type { BoardAgent } from '../src/types';

function agent(partial: Partial<BoardAgent> & Pick<BoardAgent, 'id' | 'name' | 'state'>): BoardAgent {
  return {
    tool: 'Claude Code',
    labels: [],
    owner: null,
    is_lead: false,
    state_since: '2026-01-01T00:00:00Z',
    task: null,
    context_pct: null,
    waiting_on: null,
    reason: null,
    ...partial,
  };
}

describe('groupAgentsByState', () => {
  it('groups in the fixed order and skips empty groups', () => {
    const agents = [
      agent({ id: '1', name: 'a', state: 'idle' }),
      agent({ id: '2', name: 'b', state: 'working' }),
      agent({ id: '3', name: 'c', state: 'out_of_memory' }),
      agent({ id: '4', name: 'd', state: 'working' }),
      agent({ id: '5', name: 'e', state: 'stuck' }),
    ];
    const groups = groupAgentsByState(agents);
    expect(groups.map((g) => g.state)).toEqual(['working', 'stuck', 'idle', 'out_of_memory']);
    expect(groups[0]?.agents.map((a) => a.name)).toEqual(['b', 'd']);
  });
});

describe('sortNeedsAttention', () => {
  it('orders longest wait first', () => {
    const items = [
      { agent_id: 'a', name: 'a', tool: 't', labels: [], reason: null, waiting_on: null, since: '2026-01-01T00:05:00Z' },
      { agent_id: 'b', name: 'b', tool: 't', labels: [], reason: null, waiting_on: null, since: '2026-01-01T00:01:00Z' },
      { agent_id: 'c', name: 'c', tool: 't', labels: [], reason: null, waiting_on: null, since: '2026-01-01T00:09:00Z' },
    ];
    expect(sortNeedsAttention(items).map((i) => i.agent_id)).toEqual(['b', 'a', 'c']);
  });
});

describe('buildWallRows', () => {
  it('is one row per person plus a lead-agent row', () => {
    const snapshot = buildDemoSnapshot(FREEZE_BASE);
    const rows = buildWallRows(snapshot);
    expect(rows.map((r) => r.label)).toEqual(['Maya', 'Jon', 'Priya', 'Lead agent']);
    expect(rows.map((r) => r.agents.length)).toEqual([3, 3, 3, 1]);
  });
});

describe('longestWaitSeconds', () => {
  it('returns the longest waiting/stuck wait, or null', () => {
    const snapshot = buildDemoSnapshot(FREEZE_BASE);
    const maya = snapshot.agents.filter((a) => a.owner === 'Maya');
    expect(longestWaitSeconds(maya, FREEZE_BASE)).toBeCloseTo(754, 0);
    const jon = snapshot.agents.filter((a) => a.owner === 'Jon');
    expect(longestWaitSeconds(jon, FREEZE_BASE)).toBeNull(); // stuck is not a wait
    const lead = snapshot.agents.filter((a) => a.is_lead);
    expect(longestWaitSeconds(lead, FREEZE_BASE)).toBeNull();
  });
});
