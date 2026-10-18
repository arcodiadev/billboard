import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { buildDemoSnapshot, DemoClient, FREEZE_BASE } from '../src/demo';
import { groupAgentsByState } from '../src/grouping';
import { App } from '../src/App';

describe('demo data', () => {
  it('has the acme team shape: lead + 9 agents across 3 people', () => {
    const s = buildDemoSnapshot(FREEZE_BASE);
    expect(s.team).toBe('acme');
    expect(s.lead_agent?.name).toBe('lead');
    expect(s.people).toEqual(['Maya', 'Jon', 'Priya']);
    expect(s.agents).toHaveLength(10);
    expect(s.agents.filter((a) => a.is_lead)).toHaveLength(1);
    expect(s.agents.filter((a) => !a.is_lead && !a.owner)).toHaveLength(0);
  });

  it('state counts match the lists (4/2/1/2/1)', () => {
    const s = buildDemoSnapshot(FREEZE_BASE);
    const groups = groupAgentsByState(s.agents);
    expect(groups.map((g) => [g.state, g.agents.length])).toEqual([
      ['working', 4],
      ['waiting', 2],
      ['stuck', 1],
      ['idle', 2],
      ['out_of_memory', 1],
    ]);
    for (const g of groups) {
      expect(g.agents.every((a) => a.state === g.state)).toBe(true);
    }
  });

  it('needs attention is waiting first, longest wait first (scout 12:34, triage 4:07)', () => {
    const s = buildDemoSnapshot(FREEZE_BASE);
    expect(s.needs_attention.map((n) => n.name)).toEqual(['scout', 'triage']);
    const [scout, triage] = s.needs_attention;
    expect((FREEZE_BASE - Date.parse(scout?.since ?? '')) / 1000).toBe(754);
    expect((FREEZE_BASE - Date.parse(triage?.since ?? '')) / 1000).toBe(247);
  });

  it('tools are mixed and labels never equal the agent name', () => {
    const s = buildDemoSnapshot(FREEZE_BASE);
    const tools = new Set(s.agents.map((a) => a.tool));
    expect(tools).toEqual(new Set(['Claude Code', 'Codex', 'Gemini CLI', 'acme-bot']));
    for (const a of s.agents) {
      // Mockup convention (NOTES.md): names never equal labels for the
      // agents it calls out — scout and triage.
      if (a.name === 'scout' || a.name === 'triage') {
        expect(a.labels).not.toContain(a.name);
      }
    }
  });

  it('makes zero network requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const client = new DemoClient({ freeze: true });
    await client.getSnapshot();
    const handle = client.openStream(0, {
      onAgent: () => {},
      onAgentRemoved: () => {},
      onAttention: () => {},
      onFeed: () => {},
      onSnapshot: () => {},
      onStatus: () => {},
    });
    handle.close();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('App in demo mode', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?demo=1&freeze=1');
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('renders the board without any fetch calls', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    await screen.findByRole('heading', { name: 'Agents' });
    expect(screen.getByText('team: acme')).toBeInTheDocument();
    expect(screen.getByText('Read-only · demo data')).toBeInTheDocument();
    expect(screen.getByText('12:34')).toBeInTheDocument();
    expect(screen.getByText('4:07')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('wall mode renders with ?wall=1', async () => {
    window.history.replaceState(null, '', '/?demo=1&freeze=1&wall=1');
    render(<App />);
    await screen.findByRole('main', { name: 'Wall mode' });
    await waitFor(() => expect(document.body.classList.contains('wall')).toBe(true));
    expect(screen.getByRole('region', { name: 'Maya' })).toBeInTheDocument();
    expect(screen.queryByText(/Coordinating 9 agents/)).not.toBeInTheDocument();
  });
});
