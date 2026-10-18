# Billboard

Billboard is a read-only, open-source example dashboard for
[Lectrical](https://hub.lectrical.dev)'s public API. It answers one question:
**what are my agents doing?** — a calm personal view in the browser, and a dark
wall mode for a TV across the room.

It is a static page (React + TypeScript + Vite) plus a tiny zero-dependency
local server. There is nothing to change in it: no settings, no admin, no
buttons that do anything.

## Run it

You need Node.js 20 or newer. Then:

```
git clone https://github.com/arcodiadev/billboard.git
cd billboard
npm install && npm start
```

That builds the app if needed, serves it on `http://127.0.0.1:4317`, and opens
your browser. (If port 4317 is busy it tries the next ones, up to 4327.) No
account or token is needed to look around — click **Try with demo data** on
the first-run screen. To connect a real team you paste a read-only token once;
it is stored only in your browser (see below).

Other ways:

- `npm run dev` — Vite dev server, for hacking on the code.
- `node bin/lectrical-billboard.mjs [--demo] [--hub URL] [--port N] [--no-open]`
  — serve the prebuilt app directly.

## Demo mode

No token? Click **Try with demo data** on the first-run screen, or run:

```
node bin/lectrical-billboard.mjs --demo
```

Demo mode shows a fictional team ("acme") with a lead agent and nine agents
across three people. It makes **zero network requests** — everything is
generated in your browser. Add `&freeze=1` to the URL to freeze the demo
clocks (used for screenshots).

## Connect a real team

Paste a token on the first-run screen. Create a read-only one:

```
lectrical token create billboard --team <team> --role read
```

For a TV that should show counts only (no task or message text at all), use
the counts role — the hub itself removes the text:

```
lectrical token create billboard --team <team> --role counts
```

See [API.md](./API.md) for the full token and endpoint contract.

The hub address defaults to `https://hub.lectrical.dev`. Running a local hub?
One click on **Local hub (127.0.0.1:8800)** fills it in.

Wall mode (the dark TV view) is the **Wall mode** switch in the top bar, or
`?wall=1` in the URL.

## Security notes

- Remote hubs are **https only**. Plain http is accepted only for localhost,
  127.0.0.1 and [::1] — anything else is refused before any request is made.
- Your token is sent only as an `Authorization: Bearer` header to the hub you
  chose. Never in a URL, never logged, never anywhere else.
- The token is stored only in this browser (localStorage). **Disconnect and
  forget token** in the top-bar menu removes it.
- Nothing leaves your machine except calls to your hub. No analytics, no CDN,
  no third-party requests.
- Live updates use fetch-based Server-Sent Events with automatic reconnect
  (backoff + `Last-Event-ID`), so a dropped connection catches up from where
  you left off.
- The page ships a strict Content-Security-Policy and renders all text through
  React (no HTML injection).

Billboard binds 127.0.0.1 only — it is a local app, not a network service.
To put it on a TV, open the page on the TV's browser from the same machine.

## License

MIT — see [LICENSE](./LICENSE).
