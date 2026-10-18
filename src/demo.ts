// Demo source: the mockup's "acme" team, served through the same BoardClient
// interface as the real hub. Makes zero network requests. With `freeze` the
// demo time is fixed (for screenshots): no ticking, no new feed lines.

import type {
  BoardAgent,
  BoardClient,
  FeedLine,
  NeedsAttentionItem,
  Snapshot,
  StreamHandle,
  StreamHandlers,
} from './types';

export const DEMO_TEAM = 'acme';

/** Deterministic base instant for freeze mode: 08:14:00 local time. */
export const FREEZE_BASE = new Date(2026, 0, 5, 8, 14, 0).getTime();

const FEED_LINES = [
  'coder-1 started: “Add retry to upload worker”',
  'designer is stuck: same failing export 3 times',
  'lead answered triage: “Ship v2 of the API”',
  'analyst went idle',
  'writer finished: “Draft the release notes”',
  'scout asked: “Run the migration now?”',
  'coder-2 finished: “Fix the failing export test”',
];

interface AgentSeed {
  id: string;
  name: string;
  tool: string;
  labels: string[];
  owner: string | null;
  is_lead?: boolean;
  state: BoardAgent['state'];
  /** seconds in state at the base instant */
  elapsed: number;
  task: string;
  context_pct: number;
  waiting_on?: BoardAgent['waiting_on'];
  reason?: string;
}

const AGENTS: AgentSeed[] = [
  { id: 'claude-code|lead', name: 'lead', tool: 'Claude Code', labels: ['lead'], owner: null, is_lead: true, state: 'working', elapsed: 11520, task: 'Coordinating 9 agents across 3 people', context_pct: 38 },
  { id: 'claude-code|c1', name: 'coder-1', tool: 'Claude Code', labels: [], owner: 'Maya', state: 'working', elapsed: 1560, task: 'Adding retry logic to the upload worker', context_pct: 42 },
  { id: 'codex|c2', name: 'coder-2', tool: 'Codex', labels: ['reviewer'], owner: 'Jon', state: 'working', elapsed: 2460, task: 'Fixing the failing export test', context_pct: 67 },
  { id: 'codex|writer', name: 'writer', tool: 'Codex', labels: [], owner: 'Priya', state: 'working', elapsed: 1080, task: 'Drafting the release notes for 2.4', context_pct: 31 },
  { id: 'acme-bot|scout', name: 'scout', tool: 'acme-bot', labels: ['researcher', 'on-call'], owner: 'Maya', state: 'waiting', elapsed: 754, task: 'Asking to run a migration — waiting on Maya', context_pct: 55, waiting_on: { kind: 'person', name: 'Maya' }, reason: 'Asking to run a migration' },
  { id: 'claude-code|triage', name: 'triage', tool: 'Claude Code', labels: ['on-call'], owner: 'Priya', state: 'waiting', elapsed: 247, task: 'Needs a decision: pick API version — waiting on the lead agent', context_pct: 48, waiting_on: { kind: 'lead_agent', name: 'lead' }, reason: 'Needs a decision: pick API version' },
  { id: 'gemini|designer', name: 'designer', tool: 'Gemini CLI', labels: ['designer'], owner: 'Jon', state: 'stuck', elapsed: 1080, task: 'Same failing export 3 times: “Rendered SVG is empty”', context_pct: 59, reason: 'Same failing export 3 times: “Rendered SVG is empty”' },
  { id: 'codex|reviewer', name: 'reviewer', tool: 'Codex', labels: ['reviewer'], owner: 'Maya', state: 'idle', elapsed: 540, task: 'Finished: “Review PR 118”', context_pct: 22 },
  { id: 'gemini|analyst', name: 'analyst', tool: 'Gemini CLI', labels: ['researcher'], owner: 'Priya', state: 'idle', elapsed: 3780, task: 'Finished: “Weekly usage report”', context_pct: 74 },
  { id: 'acme-bot|scraper', name: 'scraper', tool: 'acme-bot', labels: [], owner: 'Jon', state: 'out_of_memory', elapsed: 360, task: 'Context window full while summarizing crawl results', context_pct: 100 },
];

const INITIAL_FEED: { text: string; name: string; agent: string; agoSec: number }[] = [
  { name: 'coder-2', agent: 'codex|c2', text: 'coder-2 finished: “Add retry to upload”', agoSec: 120 },
  { name: 'scout', agent: 'acme-bot|scout', text: 'scout went idle', agoSec: 240 },
  { name: 'triage', agent: 'claude-code|triage', text: 'triage asked: “Which API version do we ship?”', agoSec: 420 },
  { name: 'writer', agent: 'codex|writer', text: 'writer started: “Draft the release notes”', agoSec: 720 },
  { name: 'scraper', agent: 'acme-bot|scraper', text: 'scraper ran out of memory', agoSec: 960 },
  { name: 'reviewer', agent: 'codex|reviewer', text: 'reviewer finished: “Review PR 118”', agoSec: 1380 },
];

function agentAt(seed: AgentSeed, base: number): BoardAgent {
  return {
    id: seed.id,
    name: seed.name,
    tool: seed.tool,
    labels: seed.labels,
    owner: seed.owner,
    is_lead: seed.is_lead ?? false,
    state: seed.state,
    state_since: new Date(base - seed.elapsed * 1000).toISOString(),
    task: seed.task,
    context_pct: seed.context_pct,
    waiting_on: seed.waiting_on ?? null,
    reason: seed.reason ?? null,
  };
}

function attentionFrom(agents: BoardAgent[]): NeedsAttentionItem[] {
  return agents
    .filter((a) => a.state === 'waiting' || a.state === 'stuck')
    .filter((a) => a.waiting_on !== null)
    .map((a) => ({
      agent_id: a.id,
      name: a.name,
      tool: a.tool,
      labels: a.labels,
      reason: a.reason,
      waiting_on: a.waiting_on,
      since: a.state_since,
    }))
    .sort((x, y) => Date.parse(x.since) - Date.parse(y.since));
}

export function buildDemoSnapshot(base: number): Snapshot {
  const agents = AGENTS.map((s) => agentAt(s, base));
  const feed: FeedLine[] = INITIAL_FEED.map((f, i) => ({
    rev: 42490 - i,
    at: new Date(base - f.agoSec * 1000).toISOString(),
    agent_id: f.agent,
    name: f.name,
    text: f.text,
  }));
  return {
    rev: 42494,
    team: DEMO_TEAM,
    view: 'full',
    generated_at: new Date(base).toISOString(),
    lead_agent: { id: 'claude-code|lead', name: 'lead' },
    people: ['Maya', 'Jon', 'Priya'],
    agents,
    needs_attention: attentionFrom(agents),
    feed,
  };
}

export interface DemoOptions {
  freeze?: boolean;
  /** Base instant; defaults to now (or FREEZE_BASE when frozen). */
  base?: number;
  /** Injectable timer for tests. */
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export class DemoClient implements BoardClient {
  private readonly freeze: boolean;
  private readonly base: number;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;

  constructor(opts: DemoOptions = {}) {
    this.freeze = opts.freeze ?? false;
    this.base = opts.base ?? (this.freeze ? FREEZE_BASE : Date.now());
    this.setIntervalFn = opts.setIntervalFn ?? setInterval;
    this.clearIntervalFn = opts.clearIntervalFn ?? clearInterval;
  }

  getSnapshot(): Promise<Snapshot> {
    return Promise.resolve(buildDemoSnapshot(this.base));
  }

  openStream(fromRev: number, handlers: StreamHandlers): StreamHandle {
    let rev = fromRev;
    const timers: ReturnType<typeof setInterval>[] = [];
    handlers.onStatus('live');

    if (!this.freeze) {
      let lineIdx = 0;
      timers.push(
        this.setIntervalFn(() => {
          rev += 1;
          const text = FEED_LINES[lineIdx++ % FEED_LINES.length] as string;
          const name = text.split(' ')[0] ?? '';
          handlers.onFeed({ rev, at: new Date().toISOString(), agent_id: '', name, text });
        }, 8000),
      );

      // An agent changes state now and then: analyst idles and resumes.
      let idle = false;
      timers.push(
        this.setIntervalFn(() => {
          rev += 1;
          idle = !idle;
          const seed = AGENTS.find((s) => s.name === 'analyst') as AgentSeed;
          const agent = agentAt(
            {
              ...seed,
              state: idle ? 'idle' : 'working',
              elapsed: 0,
              task: idle ? 'Finished: “Weekly usage report”' : 'Compiling the weekly usage report',
            },
            Date.now(),
          );
          handlers.onAgent(agent);
        }, 30000),
      );
    }

    return {
      close: () => {
        for (const t of timers) this.clearIntervalFn(t);
      },
    };
  }
}
