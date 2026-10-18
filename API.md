# Billboard API contract (v1) — read-only team view

Status: agreed contract between the Billboard app (built by the design seat) and the hub
(built by the dev seat). Both sides code to this file. If either side needs a change, the
engineering manager (lectrical-EM) updates this file first. Nothing here is specific to any
one agent tool, harness or customer: agents, people, a lead agent, a team, free labels.

## 1. Security
- Remote hubs are HTTPS only. Plain http is accepted only for localhost, 127.0.0.1 and ::1.
- The token is sent only as `Authorization: Bearer <token>`. Never in the URL. The board
  endpoints below must ignore `?token=` (the old EventSource workaround stays only on the old
  endpoints).
- Two token roles can read the board, both limited to one team and both unable to change
  anything (every non-GET request with them is refused with 403):
  - `read` (from the settings work, LEC-35): the full team view.
  - `counts` (new): the wall view. The server removes all text: no task, no reason, no feed
    text, no labels other than the agent name. Enforced on the server, not in the browser.
  - `owner`/`editor`/`admin` tokens may also read the board (full view); Billboard tells the
    user to use a read token instead.
- A token never sees another team. Asking for another team returns 403.
- CORS: the hub answers browser requests only from origins the team allows.
  - Team setting `browser.origins`: list of exact origins (scheme + host + port), default empty.
  - Team setting `browser.allow_localhost`: default true. Allows http://localhost:<any port>,
    http://127.0.0.1:<any port> and http://[::1]:<any port>, so Billboard run on a developer's
    machine works with no setup.
  - Preflight (OPTIONS) answered for the board endpoints only: methods GET, headers
    Authorization, Last-Event-ID; `Access-Control-Allow-Origin` echoes the allowed origin (never
    `*`), `Vary: Origin`, no `Allow-Credentials` (no cookies are ever used), max-age 600.
  - Because the token decides the team, the preflight (which has no token) may allow an origin
    that is in any team's list or is localhost when allowed; the real request is then checked
    against the token's team. A disallowed origin gets no CORS headers.
- Responses carry `Cache-Control: no-store`.

## 2. Endpoints (team comes from the token; `?team=` optional, must match)
### GET /api/board/snapshot
```json
{
  "rev": 42494,
  "team": "acme",
  "view": "full",                       // or "counts"
  "generated_at": "2026-10-18T15:26:01Z",
  "lead_agent": {"id": "claude-code|abc", "name": "lead"},   // null if none set
  "people": ["Maya", "Jon", "Priya"],
  "agents": [{
    "id": "claude-code|abc",            // stable item id: "<source>|<id>"
    "name": "scout",
    "tool": "Claude Code",              // human tool name, from the source
    "labels": ["researcher", "on-call"],// free labels (full view only)
    "owner": "Maya",                    // person, from the label owner=..., null if unknown
    "is_lead": false,
    "state": "working",                 // working | waiting | stuck | idle | out_of_memory
    "state_since": "2026-10-18T15:20:00Z",
    "task": "Add retry to upload",      // full view only, null if unknown
    "context_pct": 62,                  // null if unknown
    "waiting_on": {"kind": "person", "name": "Maya"},   // or {"kind":"lead_agent","name":"lead"} or null
    "reason": "Asking to run a migration"               // full view only, when waiting/stuck
  }],
  "needs_attention": [{                 // waiting or stuck agents, longest wait first
    "agent_id": "claude-code|abc", "name": "scout", "tool": "Claude Code",
    "labels": ["researcher"], "reason": "Asking to run a migration",   // full view only
    "waiting_on": {"kind": "person", "name": "Maya"}, "since": "2026-10-18T15:01:00Z"
  }],
  "feed": [{"rev": 42490, "at": "2026-10-18T15:12:00Z", "agent_id": "codex|x",
            "name": "coder-2", "text": "finished: Add retry to upload"}]   // full view only, newest first, max 50
}
```
In the counts view: `labels`, `task`, `reason` are absent; `feed` is `[]`.

### GET /api/board/needs-attention
`{"rev": ..., "team": ..., "needs_attention": [...]}` (same shape as above).

### GET /api/board/stream  (Server-Sent Events)
- Request headers: `Authorization`, optional `Last-Event-ID: <rev>`.
- Each message has `id: <rev>`. Event names:
  - `agent`: data = one agent object (same shape and view rules as the snapshot); replace by id.
  - `agent_removed`: data = `{"id": "..."}`.
  - `attention`: data = the full `needs_attention` list.
  - `feed`: data = one feed line (full view only).
  - `reset`: data = `{"reason": "too_far_behind"}`. Sent when Last-Event-ID is older than what the
    hub still keeps; the client must fetch the snapshot again and reopen the stream from its rev.
  - `ping` every 15 s: data = `{"rev": N}` (no id).
- With Last-Event-ID the hub sends every change after that rev, then live changes. No gap, no
  duplicates.

## 3. State mapping (documented in SPEC.md; one table in code)
| hub status / signal                                  | board state    |
|------------------------------------------------------|----------------|
| working                                              | working        |
| needs_input, needs_you, blocked (asking a person or the lead agent) | waiting |
| stuck (no progress past the team threshold), failed, error | stuck   |
| idle, done                                           | idle           |
| out_of_memory (context full / process killed for memory) | out_of_memory |
| gone / inactive                                      | not listed     |
`waiting_on`: an explicit `waiting_on` field or label on the item wins; otherwise a waiting agent
waits on its `owner`; if it has no owner, on the team's lead agent.
