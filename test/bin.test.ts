// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'lectrical-billboard.mjs');

interface RunningServer {
  url: string;
  port: number;
  stop(): void;
}

async function startBin(args: string[]): Promise<RunningServer> {
  const child = spawn('node', [bin, '--no-open', '--port', '0', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise<string>((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`bin did not start. stdout: ${out}`)), 15000);
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      const m = out.match(/Billboard is running at (http:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1] as string);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`bin exited with code ${code}. stdout: ${out}`));
    });
  });
  const port = Number(new URL(url).port);
  return { url, port, stop: () => child.kill('SIGTERM') };
}

describe('bin/lectrical-billboard.mjs', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startBin([]);
  }, 30000);

  afterAll(() => {
    server?.stop();
  });

  it('binds 127.0.0.1 only', () => {
    expect(new URL(server.url).hostname).toBe('127.0.0.1');
  });

  it('serves index.html at /', async () => {
    const res = await fetch(`${server.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<div id="root"></div>');
    expect(body).toContain('Content-Security-Policy');
  });

  it('sends the security headers', async () => {
    const res = await fetch(`${server.url}/`);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('refuses path traversal', async () => {
    for (const p of [
      '/..%2f..%2fpackage.json',
      '/%2e%2e%2f%2e%2e%2fpackage.json',
      '/assets/..%2f..%2fbin%2flectrical-billboard.mjs',
    ]) {
      const res = await fetch(`${server.url}${p}`);
      expect([400, 403, 404]).toContain(res.status);
      const body = await res.text();
      expect(body).not.toContain('"name": "lectrical-billboard"');
    }
  });

  it('404s unknown non-page paths', async () => {
    const res = await fetch(`${server.url}/nope.js`);
    expect(res.status).toBe(404);
  });

  it('serves the built JS bundle', async () => {
    const index = await (await fetch(`${server.url}/`)).text();
    const src = index.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    expect(src).toBeTruthy();
    const res = await fetch(`${server.url}${src}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
  });
});

describe('bin --demo flag', () => {
  it('passes demo mode as a query param, never a token', async () => {
    const server = await startBin(['--demo', '--hub', 'http://127.0.0.1:8800']);
    try {
      expect(server.url).not.toContain('token');
    } finally {
      server.stop();
    }
  }, 30000);
});
