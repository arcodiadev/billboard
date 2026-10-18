#!/usr/bin/env node
// lectrical-billboard — zero-runtime-dependency static server for the
// prebuilt Billboard app. Node's built-in http module only.
//
// Usage: node bin/lectrical-billboard.mjs [--demo] [--hub URL] [--port N] [--no-open]
//
// Serves dist/ on 127.0.0.1 (never 0.0.0.0), default port 4317 (if busy,
// tries 4318..4327). A token is NEVER accepted on the command line or in a
// URL — paste it into the page.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4317;
const MAX_PORT = 4327;

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  'connect-src https: http://localhost:* http://127.0.0.1:* http://[::1]:*; ' +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function parseArgs(argv) {
  const opts = { demo: false, hub: null, port: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--demo') opts.demo = true;
    else if (arg === '--no-open') opts.open = false;
    else if (arg === '--hub') opts.hub = argv[++i] ?? null;
    else if (arg === '--port') opts.port = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: lectrical-billboard [--demo] [--hub URL] [--port N] [--no-open]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (opts.port !== null && (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535)) {
    console.error(`Invalid port: ${opts.port}`);
    process.exit(2);
  }
  return opts;
}

function pageUrl(port, opts) {
  const params = new URLSearchParams();
  if (opts.demo) params.set('demo', '1');
  if (opts.hub) params.set('hub', opts.hub);
  const q = params.toString();
  return `http://${HOST}:${port}/${q ? `?${q}` : ''}`;
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(cmd, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Opening the browser is best-effort.
  }
}

async function serve(req, res) {
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  };

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${HOST}`).pathname);
  } catch {
    return send(400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (pathname === '/') pathname = '/index.html';

  // Refuse path traversal: the resolved path must stay inside dist/.
  const filePath = path.resolve(root, '.' + pathname);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return send(403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    send(200, body, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  } catch {
    // SPA-style fallback: unknown paths that accept HTML get the app shell.
    if ((req.headers.accept ?? '').includes('text/html')) {
      const body = await readFile(path.join(root, 'index.html'));
      return send(200, body, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    }
    send(404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

async function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  try {
    const info = await stat(path.join(root, 'index.html'));
    if (!info.isFile()) throw new Error('missing');
  } catch {
    console.error('Billboard is not built yet. Run `npm run build` first (or just `npm start`).');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    serve(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, SECURITY_HEADERS);
      res.end('Internal error');
    });
  });

  const explicit = opts.port !== null;
  let port = opts.port ?? DEFAULT_PORT;
  for (;;) {
    try {
      await listen(server, port);
      break;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        if (explicit || port >= MAX_PORT) {
          console.error(
            explicit
              ? `Port ${port} is busy. Pick another with --port.`
              : `Ports ${DEFAULT_PORT}–${MAX_PORT} are all busy. Free one and try again.`,
          );
          process.exit(1);
        }
        console.error(`Port ${port} is busy, trying ${port + 1}.`);
        port += 1;
        continue;
      }
      throw err;
    }
  }

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;
  const url = pageUrl(actualPort, opts);
  console.log(`Billboard is running at http://${HOST}:${actualPort}`);
  if (opts.open) openBrowser(url);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
