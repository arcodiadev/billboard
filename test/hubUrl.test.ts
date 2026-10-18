import { describe, expect, it } from 'vitest';
import { validateHubUrl } from '../src/hubUrl';

describe('validateHubUrl', () => {
  it('accepts https', () => {
    const r = validateHubUrl('https://hub.lectrical.dev');
    expect(r).toEqual({ ok: true, url: 'https://hub.lectrical.dev' });
  });

  it('accepts http for localhost', () => {
    expect(validateHubUrl('http://localhost:8800')).toEqual({ ok: true, url: 'http://localhost:8800' });
    expect(validateHubUrl('http://127.0.0.1:8800')).toEqual({ ok: true, url: 'http://127.0.0.1:8800' });
    expect(validateHubUrl('http://[::1]:8800')).toEqual({ ok: true, url: 'http://[::1]:8800' });
  });

  it('refuses plain http for anything else', () => {
    const r = validateHubUrl('http://hub.lectrical.dev');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/localhost/);
  });

  it('refuses javascript: and file: URLs before any request', () => {
    expect(validateHubUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateHubUrl('file:///etc/passwd').ok).toBe(false);
  });

  it('refuses empty and invalid input', () => {
    expect(validateHubUrl('').ok).toBe(false);
    expect(validateHubUrl('not a url').ok).toBe(false);
  });
});
