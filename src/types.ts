// Types matching billboard/API.md (the Billboard API contract, v1).

export type AgentState = 'working' | 'waiting' | 'stuck' | 'idle' | 'out_of_memory';

export const STATE_ORDER: AgentState[] = ['working', 'waiting', 'stuck', 'idle', 'out_of_memory'];

export const STATE_LABEL: Record<AgentState, string> = {
  working: 'Working',
  waiting: 'Waiting',
  stuck: 'Stuck',
  idle: 'Idle',
  out_of_memory: 'Out of memory',
};

export const STATE_CLASS: Record<AgentState, string> = {
  working: 's-working',
  waiting: 's-waiting',
  stuck: 's-stuck',
  idle: 's-idle',
  out_of_memory: 's-oom',
};

export interface WaitingOn {
  kind: 'person' | 'lead_agent';
  name: string;
}

export interface BoardAgent {
  id: string;
  name: string;
  tool: string;
  labels: string[];
  owner: string | null;
  is_lead: boolean;
  state: AgentState;
  state_since: string;
  task: string | null;
  context_pct: number | null;
  waiting_on: WaitingOn | null;
  reason: string | null;
}

export interface NeedsAttentionItem {
  agent_id: string;
  name: string;
  tool: string;
  labels: string[];
  reason: string | null;
  waiting_on: WaitingOn | null;
  since: string;
}

export interface FeedLine {
  rev: number;
  at: string;
  agent_id: string;
  name: string;
  text: string;
}

export interface Snapshot {
  rev: number;
  team: string;
  view: 'full' | 'counts';
  generated_at: string;
  lead_agent: { id: string; name: string } | null;
  people: string[];
  agents: BoardAgent[];
  needs_attention: NeedsAttentionItem[];
  feed: FeedLine[];
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

export interface StreamHandlers {
  onAgent(agent: BoardAgent): void;
  onAgentRemoved(id: string): void;
  onAttention(items: NeedsAttentionItem[]): void;
  onFeed(line: FeedLine): void;
  onSnapshot(snapshot: Snapshot): void;
  onStatus(status: ConnectionStatus): void;
}

export interface StreamHandle {
  close(): void;
}

/** One client interface for both the real hub and the demo source. */
export interface BoardClient {
  getSnapshot(): Promise<Snapshot>;
  openStream(fromRev: number, handlers: StreamHandlers): StreamHandle;
}
