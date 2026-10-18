import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WallView } from '../src/components/WallView';
import { buildDemoSnapshot, FREEZE_BASE } from '../src/demo';

function renderWall() {
  const snapshot = buildDemoSnapshot(FREEZE_BASE);
  return render(
    <WallView
      snapshot={snapshot}
      now={FREEZE_BASE}
      lastUpdate={FREEZE_BASE}
      reconnecting={false}
      onExit={() => {}}
      onDisconnect={() => {}}
    />,
  );
}

describe('WallView', () => {
  it('renders one row per person plus a lead-agent row', () => {
    renderWall();
    expect(screen.getByRole('main', { name: 'Wall mode' })).toBeInTheDocument();
    for (const label of ['Maya', 'Jon', 'Priya', 'Lead agent']) {
      expect(screen.getByRole('region', { name: label })).toBeInTheDocument();
    }
  });

  it('renders no task, reason, label or feed text even with a full token', () => {
    renderWall();
    // Tasks
    expect(screen.queryByText(/Coordinating 9 agents/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Adding retry logic/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Context window full/)).not.toBeInTheDocument();
    // Reasons
    expect(screen.queryByText(/Asking to run a migration/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Needs a decision/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Same failing export/)).not.toBeInTheDocument();
    // Labels that are not also agent names
    expect(screen.queryByText('researcher')).not.toBeInTheDocument();
    expect(screen.queryByText('on-call')).not.toBeInTheDocument();
    // Feed text
    expect(screen.queryByText(/finished:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/went idle/)).not.toBeInTheDocument();
    expect(screen.queryByText('Live feed')).not.toBeInTheDocument();
  });

  it('shows frozen demo clocks', () => {
    renderWall();
    expect(screen.getByText('12:34')).toBeInTheDocument();
    expect(screen.getByText('4:07')).toBeInTheDocument();
  });

  it('does not call fetch', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    renderWall();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
