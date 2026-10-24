// Connect-time messages for the hub address. Each one names the hub that was
// tried. They never include the token.

import { ApiError } from './client';

/** Probe used to tell an unreachable hub from a CORS refusal. Sends no credentials. */
export type Probe = (url: string) => Promise<unknown>;

export interface ConnectFailure {
  message: string;
  /**
   * True when the saved hub address itself looks wrong or unreachable, so a
   * saved one should be reset. False when the hub was reached (a bad token, a
   * server error, or a CORS refusal): the address is still right.
   */
  resetHub: boolean;
}

/**
 * Explains a failed connect. Browsers hide whether a request was refused by
 * CORS or never reached the hub, so a network failure is probed with a
 * credential-free no-cors request: if that resolves, the hub is up and the
 * browser most likely blocked this page's origin.
 */
export async function describeConnectError(
  err: unknown,
  hub: string,
  pageOrigin: string,
  probe: Probe,
): Promise<ConnectFailure> {
  const tried = `Hub tried: ${hub}.`;
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return { message: `${err.message} ${tried}`, resetHub: false };
    }
    if (err.reason === 'not-api' || err.status === 404) {
      return {
        message: `The hub at ${hub} answered, but not with the Billboard API. Check the hub address. ${tried}`,
        resetHub: true,
      };
    }
    return { message: `${err.message} ${tried}`, resetHub: false };
  }
  try {
    await probe(`${hub}/health`);
  } catch {
    return {
      message: `Could not reach the hub at ${hub}. Check the address and your connection. ${tried}`,
      resetHub: true,
    };
  }
  return {
    message: `The browser blocked the request to ${hub}, but the hub is reachable. This is probably a CORS refusal: ask a team admin to add ${pageOrigin} to the team's browser.origins setting. ${tried}`,
    resetHub: false,
  };
}

/** The probe the app uses in production. */
export const defaultProbe: Probe = (url) => fetch(url, { mode: 'no-cors', credentials: 'omit' });
