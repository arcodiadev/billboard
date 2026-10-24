import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { DotsMenu } from '../src/components/DotsMenu';
import { buildDemoSnapshot, FREEZE_BASE } from '../src/demo';

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

describe('connect errors and saved hub', () => {
  const TOKEN = 'lck_test_123';
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function isProbe(input: unknown): boolean {
    return String(input).endsWith('/health');
  }

  it('names the hub and says it is unreachable when the network and the probe both fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Paste your Lectrical token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not reach the hub at https://hub.lectrical.dev.');
    expect(alert).not.toHaveTextContent(TOKEN);
  });

  it('gives a probable CORS message, naming the page origin, when the hub answers the probe', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (isProbe(input)) return Promise.resolve({ type: 'opaque' } as unknown as Response);
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Paste your Lectrical token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('probably a CORS refusal');
    expect(alert).toHaveTextContent("browser.origins setting");
    expect(alert).toHaveTextContent('Hub tried: https://hub.lectrical.dev.');
  });

  it('gives a wrong-address message when the hub answers 404 on the board API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    } as unknown as Response);
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Paste your Lectrical token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'answered, but not with the Billboard API. Check the hub address.',
    );
  });

  it('a saved hub that fails resets the hub box to the default and says so', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', TOKEN);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The saved hub address https://old-hub.example.net failed.');
    expect(alert).toHaveTextContent('The hub box now shows https://hub.lectrical.dev.');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://hub.lectrical.dev');
  });

  it('a hub the user typed is not reset when it fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    await screen.findByRole('heading', { name: 'Connect Billboard to Lectrical' });
    const user = userEvent.setup();
    const hub = screen.getByLabelText('Hub address');
    await user.clear(hub);
    await user.type(hub, 'https://typed.example.net');
    await user.type(screen.getByLabelText('Paste your Lectrical token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://typed.example.net');
  });
});

describe('saved hub reset rules', () => {
  const TOKEN = 'lck_test_123';
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function isProbe(input: unknown): boolean {
    return String(input).endsWith('/health');
  }

  it('a saved hub that answers 404 resets the box and names the saved address', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', TOKEN);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) } as unknown as Response);
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The saved hub address https://old-hub.example.net failed.');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://hub.lectrical.dev');
  });

  it.each([401, 403])('a saved hub that rejects the token with %i keeps the saved address', async (status) => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', TOKEN);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This token can't read a team.");
    expect(alert).not.toHaveTextContent('saved hub address');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://old-hub.example.net');
  });

  it.each(['saved', 'typed'])('unrelated JSON from a %s hub is a not-API failure', async (source) => {
    const address = 'https://wrong.example.net';
    if (source === 'saved') {
      window.localStorage.setItem('billboard.hub', address);
      window.localStorage.setItem('billboard.token', TOKEN);
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    render(<App />);
    if (source === 'typed') {
      const user = userEvent.setup();
      const hub = await screen.findByLabelText('Hub address');
      await user.clear(hub);
      await user.type(hub, address);
      await user.type(screen.getByLabelText('Paste your Lectrical token'), TOKEN);
      await user.click(screen.getByRole('button', { name: 'Connect' }));
    }
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(`The hub at ${address} answered, but not with the Billboard API.`);
    expect(screen.getByLabelText('Hub address')).toHaveValue(
      source === 'saved' ? 'https://hub.lectrical.dev' : address,
    );
    if (source === 'saved') {
      expect(alert).toHaveTextContent(`The saved hub address ${address} failed.`);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('a saved hub that is reached but blocked by CORS keeps the saved address', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', TOKEN);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (isProbe(input)) return Promise.resolve({ type: 'opaque' } as unknown as Response);
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('probably a CORS refusal');
    expect(alert).not.toHaveTextContent('saved hub address');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://old-hub.example.net');
  });

  it('when the saved hub is the default, the message does not name it twice', async () => {
    window.localStorage.setItem('billboard.hub', 'https://hub.lectrical.dev');
    window.localStorage.setItem('billboard.token', TOKEN);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('now shows');
    expect(alert).toHaveTextContent('The saved hub failed. Could not reach the hub at https://hub.lectrical.dev.');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://hub.lectrical.dev');
  });

  it('a late saved-hub failure keeps a hub and token typed while it was pending', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', TOKEN);
    let rejectSnapshot!: (error: Error) => void;
    const pending = new Promise<Response>((_resolve, reject) => {
      rejectSnapshot = reject;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      isProbe(input) ? Promise.reject(new TypeError('Failed to fetch')) : pending,
    );
    render(<App />);
    const user = userEvent.setup();
    const hub = screen.getByLabelText('Hub address');
    await user.clear(hub);
    await user.type(hub, 'https://typed.example.net');
    await user.type(screen.getByLabelText('Paste your Lectrical token'), 'lck_test_new');
    await act(async () => {
      rejectSnapshot(new TypeError('Failed to fetch'));
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The saved hub address https://old-hub.example.net failed.');
    expect(alert).not.toHaveTextContent('now shows');
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://typed.example.net');
    expect(screen.getByLabelText('Paste your Lectrical token')).toHaveValue('lck_test_new');
  });

  it('after Disconnect and forget token the hub box shows the default again', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', TOKEN);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      String(input).endsWith('/api/board/snapshot')
        ? Promise.resolve(Response.json(buildDemoSnapshot(FREEZE_BASE)))
        : new Promise<Response>(() => {}),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Agents' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Billboard menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Disconnect and forget token' }));
    expect(window.localStorage.getItem('billboard.hub')).toBeNull();
    expect(window.localStorage.getItem('billboard.token')).toBeNull();
    expect(screen.getByLabelText('Hub address')).toHaveValue('https://hub.lectrical.dev');
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

  it('hides as soon as it is clicked, with no error shown and no clock tick', async () => {
    window.history.replaceState(null, '', '/?freeze=1');
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Forget saved hub and token' }));
    expect(window.localStorage.getItem('billboard.hub')).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Forget saved hub and token' })).not.toBeInTheDocument();
  });

  it('a connect pending at Forget cannot save credentials back or open the board', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', 'lck_test_old');
    let resolveSnapshot!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveSnapshot = resolve;
    });
    let snapshots = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (!String(input).endsWith('/api/board/snapshot')) return new Promise<Response>(() => {});
      snapshots += 1;
      return snapshots === 1 ? Promise.resolve(new Response(null, { status: 403 })) : pending;
    });
    render(<App />);
    await screen.findByRole('alert');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Paste your Lectrical token'), 'lck_test_new');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Forget saved hub and token' }));
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
    await act(async () => {
      resolveSnapshot(Response.json(buildDemoSnapshot(FREEZE_BASE)));
    });
    expect(window.localStorage.getItem('billboard.hub')).toBeNull();
    expect(window.localStorage.getItem('billboard.token')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Agents' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connect Billboard to Lectrical' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Forget saved hub and token' })).not.toBeInTheDocument();
  });

  it('a saved connect pending at Forget does not report its later failure', async () => {
    window.localStorage.setItem('billboard.hub', 'https://old-hub.example.net');
    window.localStorage.setItem('billboard.token', 'lck_test_old');
    let rejectSnapshot!: (error: Error) => void;
    const pending = new Promise<Response>((_resolve, reject) => {
      rejectSnapshot = reject;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      String(input).endsWith('/health') ? Promise.reject(new TypeError('Failed to fetch')) : pending,
    );
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Forget saved hub and token' }));
    await act(async () => {
      rejectSnapshot(new TypeError('Failed to fetch'));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('billboard.hub')).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  });
});
