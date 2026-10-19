import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/client';
import { describeConnectError } from '../src/connectErrors';

const HUB = 'https://hub.example.com';
const PAGE = 'https://billboard.example.org';
const TOKEN = 'lck_test_token_0000000000000000'; // fake token, tests only

const reachable = vi.fn().mockResolvedValue({ type: 'opaque' });
const unreachable = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

describe('describeConnectError', () => {
  it('names the hub for a 401/403 and keeps the plain-English text, without resetting the address', async () => {
    const f = await describeConnectError(new ApiError(403, "This token can't read a team."), HUB, PAGE, reachable);
    expect(f).toEqual({ message: `This token can't read a team. Hub tried: ${HUB}.`, resetHub: false });
    expect(reachable).not.toHaveBeenCalled();
  });

  it('reports a wrong address on a 404 from the board API, and resets the address', async () => {
    const f = await describeConnectError(new ApiError(404, 'not found'), HUB, PAGE, reachable);
    expect(f.message).toBe(
      `The hub at ${HUB} answered, but not with the Billboard API. Check the hub address. Hub tried: ${HUB}.`,
    );
    expect(f.resetHub).toBe(true);
  });

  it('reports a wrong address when the hub answers with a body that is not board data, and resets', async () => {
    const f = await describeConnectError(
      new ApiError(200, 'The hub answered, but not with board data.', 'not-api'),
      HUB,
      PAGE,
      reachable,
    );
    expect(f.message).toContain('answered, but not with the Billboard API');
    expect(f.message).toContain(`Hub tried: ${HUB}.`);
    expect(f.resetHub).toBe(true);
  });

  it('reports an unreachable hub when the network and the probe both fail, and resets', async () => {
    const f = await describeConnectError(new TypeError('Failed to fetch'), HUB, PAGE, unreachable);
    expect(f).toEqual({
      message: `Could not reach the hub at ${HUB}. Check the address and your connection. Hub tried: ${HUB}.`,
      resetHub: true,
    });
    expect(unreachable).toHaveBeenCalledWith(`${HUB}/health`);
  });

  it('words a probable CORS refusal, names the page origin, and keeps the address', async () => {
    const f = await describeConnectError(new TypeError('Failed to fetch'), HUB, PAGE, reachable);
    expect(f.message).toContain('probably a CORS refusal');
    expect(f.message).toContain(`add ${PAGE} to the team's browser.origins setting`);
    expect(f.message).toContain(`Hub tried: ${HUB}.`);
    expect(f.resetHub).toBe(false);
  });

  it('keeps the address for a server error from a reachable hub', async () => {
    const f = await describeConnectError(new ApiError(500, 'The hub answered with an error (status 500).'), HUB, PAGE, reachable);
    expect(f.resetHub).toBe(false);
  });

  it('never puts the token in any message', async () => {
    const results = await Promise.all([
      describeConnectError(new ApiError(403, 'x'), HUB, PAGE, reachable),
      describeConnectError(new TypeError('Failed to fetch'), HUB, PAGE, unreachable),
      describeConnectError(new TypeError('Failed to fetch'), HUB, PAGE, reachable),
    ]);
    for (const f of results) expect(f.message).not.toContain(TOKEN);
  });
});
