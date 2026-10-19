import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import type { Snapshot } from '../src/types';

const snapshot: Snapshot = {
  rev: 1,
  team: 'example',
  view: 'full',
  generated_at: '2026-01-01T00:00:00Z',
  lead_agent: null,
  people: [],
  agents: [],
  needs_attention: [],
  feed: [],
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe.each(['pasted', 'stored'] as const)('%s token input', (source) => {
  async function connect(input: string): Promise<void> {
    if (source === 'stored') {
      window.localStorage.setItem('billboard.hub', 'https://hub.example.com');
      window.localStorage.setItem('billboard.token', input);
      render(<App />);
    } else {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByLabelText('Paste your Lectrical token'));
      await user.paste(input);
      await user.click(screen.getByRole('button', { name: 'Connect' }));
    }
  }

  it('removes surrounding and internal whitespace before fetching', async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(snapshot))
      .mockImplementation(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchFn);

    await connect(' \t ex\r\nam ple\t\u00a0 \n');

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    for (const [, init] of fetchFn.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer example');
    }
    if (source === 'pasted') {
      expect(window.localStorage.getItem('billboard.token')).toBe('example');
    }
  });

  it.each([
    { label: 'non-ASCII', input: 'example\u00e9' },
    { label: 'control', input: 'example\u0001' },
    { label: 'DEL', input: 'example\u007f' },
  ])('rejects $label characters without fetching or echoing the input', async ({ input }) => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Invalid header'));
    vi.stubGlobal('fetch', fetchFn);

    await connect(input);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe("That token has characters a header can't carry.");
    expect(alert.textContent).not.toContain(input);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each(['', ' \r\n\t '])('rejects empty input after removing whitespace', async (input) => {
    const fetchFn = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchFn);

    await connect(input);

    expect(await screen.findByRole('alert')).toHaveTextContent('Paste your token first.');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
