import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { DotsMenu } from '../src/components/DotsMenu';

describe('DotsMenu', () => {
  it('is keyboard reachable and closes on Escape', async () => {
    const onSelect = vi.fn();
    render(<DotsMenu label="Row menu" items={[{ label: 'Copy agent id', onSelect }]} />);
    const button = screen.getByRole('button', { name: 'Row menu' });
    const user = userEvent.setup();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    const item = screen.getByRole('menuitem', { name: 'Copy agent id' });
    expect(item).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes on outside click', async () => {
    render(
      <div>
        <DotsMenu label="Row menu" items={[{ label: 'Copy agent id', onSelect: () => {} }]} />
        <button type="button">elsewhere</button>
      </div>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Row menu' }));
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

describe('first-run token screen', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it('shows no "Live", updated time or team tag before connecting', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    expect(screen.queryByText(/^Live/)).not.toBeInTheDocument();
    expect(screen.queryByText(/updated/)).not.toBeInTheDocument();
    expect(screen.queryByText(/team:/)).not.toBeInTheDocument();
    // But it does have the hub field, local-hub choice, token field, note, actions.
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://hub.lectrical.dev');
    expect(screen.getByRole('button', { name: 'Local hub (127.0.0.1:8800)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Paste your Lectrical token')).toBeInTheDocument();
    expect(screen.getByText('Stored only in this browser. Use a read-only token.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try with demo data' })).toBeInTheDocument();
  });

  it('local hub choice fills the hub field', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Local hub (127.0.0.1:8800)' }));
    expect(screen.getByLabelText('Hub address')).toHaveValue('http://127.0.0.1:8800');
  });

  it('refuses a non-local http hub before any request', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    const hub = screen.getByLabelText('Hub address');
    await user.clear(hub);
    await user.type(hub, 'http://hub.example.com');
    await user.type(screen.getByLabelText('Paste your Lectrical token'), 'lck_test_123');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/http is allowed only for a local hub/);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows a plain-English message when the token cannot read a team', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    } as unknown as Response);
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Paste your Lectrical token'), 'lck_test_123');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("This token can't read a team.");
    spy.mockRestore();
  });
});

describe('agent row menu', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?demo=1&freeze=1');
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('copies the agent id and nothing else changes anything', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Agents' });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByRole('button', { name: /^Actions for agent / });
    expect(menuButtons.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Actions for agent scout' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Copy agent id']);
    await user.click(screen.getByRole('menuitem', { name: 'Copy agent id' }));
    // user-event installs a clipboard stub; the id must have landed there.
    await expect(window.navigator.clipboard.readText()).resolves.toBe('acme-bot|scout');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('top bar menu offers Disconnect and forget token', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Agents' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Billboard menu' }));
    expect(screen.getByRole('menuitem', { name: 'Disconnect and forget token' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Disconnect and forget token' }));
    expect(await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' })).toBeInTheDocument();
  });
});

describe('forget saved hub and token', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('is absent when nothing is saved', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    expect(screen.queryByRole('button', { name: 'Forget saved hub and token' })).not.toBeInTheDocument();
  });

  it('shows on the connect screen when a saved value exists, and clears it', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', 'lck_test_123');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    await screen.findByRole('alert');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Forget saved hub and token' }));
    expect(window.localStorage.getItem('billboard.hub')).toBeNull();
    expect(window.localStorage.getItem('billboard.token')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Forget saved hub and token' })).not.toBeInTheDocument();
  });
});
