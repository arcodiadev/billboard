// Hub address validation: https only, except plain http for loopback.

export type HubUrlResult = { ok: true; url: string } | { ok: false; error: string };

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

export function validateHubUrl(input: string): HubUrlResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a hub address, like https://hub.lectrical.dev.' };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'That hub address is not a valid URL. Use https://… (http is allowed only for localhost).' };
  }
  if (url.protocol === 'https:') {
    return { ok: true, url: url.origin };
  }
  if (url.protocol === 'http:' && isLoopbackHostname(url.hostname)) {
    return { ok: true, url: url.origin };
  }
  if (url.protocol === 'http:') {
    return { ok: false, error: 'Plain http is allowed only for a local hub (localhost, 127.0.0.1 or [::1]). Use https:// for a remote hub.' };
  }
  return { ok: false, error: 'That hub address is not allowed. Use https://… (http is allowed only for localhost).' };
}
