// Grouping helpers: agents by state, needs-attention order, wall rows.

import type { AgentState, BoardAgent, NeedsAttentionItem, Snapshot } from './types';
import { STATE_ORDER } from './types';

export interface StateGroup {
  state: AgentState;
  agents: BoardAgent[];
}

/** Groups agents in the fixed order Working / Waiting / Stuck / Idle / Out of memory. */
export function groupAgentsByState(agents: BoardAgent[]): StateGroup[] {
  return STATE_ORDER.map((state) => ({
    state,
    agents: agents.filter((a) => a.state === state),
  })).filter((g) => g.agents.length > 0);
}

/** Needs attention = waiting + stuck, longest wait first. */
export function sortNeedsAttention(items: NeedsAttentionItem[]): NeedsAttentionItem[] {
  return [...items].sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
}

export interface WallRow {
  /** Person's name, or "Lead agent". */
  label: string;
  agents: BoardAgent[];
}

/** Wall mode = one row per person plus a lead-agent row. */
export function buildWallRows(snapshot: Snapshot): WallRow[] {
  const rows: WallRow[] = snapshot.people.map((person) => ({
    label: person,
    agents: snapshot.agents.filter((a) => a.owner === person && !a.is_lead),
  }));
  const leadAgents = snapshot.agents.filter((a) => a.is_lead);
  if (leadAgents.length > 0) {
    rows.push({ label: 'Lead agent', agents: leadAgents });
  }
  return rows;
}

/** Longest current wait (agents waiting on someone) among the given agents. */
export function longestWaitSeconds(agents: BoardAgent[], now: number): number | null {
  let best: number | null = null;
  for (const a of agents) {
    if (a.state !== 'waiting') continue;
    const s = Math.max(0, (now - Date.parse(a.state_since)) / 1000);
    if (best === null || s > best) best = s;
  }
  return best;
}
