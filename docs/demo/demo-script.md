# Demo Script — ~2 minutes

The scripted version of this is `pnpm demo` (see [README.md](../../README.md#run-the-demo)). This
document is the manual walkthrough — useful for recording a video, or for anyone who wants to see
each step happen instead of trusting a script.

## 0. Setup (before recording)

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY and SLACK_BOT_TOKEN in .env for the full happy path —
# or leave them blank to still see the pipeline run (the AI/Slack step then fails
# with a clear error instead of a crash)
pnpm install
```

## 1. Bring the project up (~30s)

```bash
docker compose up -d      # Postgres + Redis
pnpm seed                 # creates the demo Workflow (demo-webhook-to-slack) plus its
                           # owning demo-workspace and a demo user account
pnpm --filter @flowmind/api dev
```

Say: "This is FlowMind AI — a webhook trigger, an AI step through Claude, and a Slack
notification, all workspace-scoped: every request below only ever sees the demo account's own
Workflow and runs, exactly as v0.4.0's multi-tenant auth requires."

## 2. Show the health check (~15s)

```bash
curl http://localhost:3001/health
```

```json
{
  "api": "ok",
  "postgres": "ok",
  "redis": "ok",
  "queue": "ok",
  "anthropic": "configured",
  "slack": "configured"
}
```

Say: "Every dependency the app needs is checked here — database, cache/queue, and whether the AI
and Slack credentials are even configured." `/health` is the one endpoint below that needs no
authentication — everything else is workspace-scoped and requires a token.

## 3. Authenticate as the demo user (~15s)

Every route below `/health` requires a valid access token — `pnpm seed` already created the demo
account (`packages/infrastructure/prisma/seed.ts`'s `DEMO_USER_EMAIL`/`DEMO_USER_PASSWORD`; these
are fixed, non-secret, dev-only fixture values, not real credentials for anything):

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@flowmind.local","password":"flowmind-demo-password"}'
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "...", "email": "demo@flowmind.local", "workspaceId": "demo-workspace" }
}
```

Say: "That access token is short-lived — 15 minutes — and scoped to exactly one workspace. Every
call from here on sends it as a bearer token; the API never trusts a workspace id supplied by the
caller, only the one baked into this token."

Capture it in a shell variable for the rest of the walkthrough:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@flowmind.local","password":"flowmind-demo-password"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))")
```

## 4. Execute the workflow (~30s)

```bash
curl -X POST http://localhost:3001/webhooks/demo-webhook-to-slack \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"Customer reported a checkout error and needs urgent help."}'
```

```json
{ "accepted": true }
```

Say: "That's it from the caller's side — the request is queued and returns immediately. A BullMQ
Worker picks it up, runs the Engine, calls Claude, and posts to Slack, all within the demo
account's workspace."

## 5. Show the Slack message (~15s)

Switch to the Slack channel the demo workflow posts to (`SLACK_CHANNEL` in `.env`, default
`#alerts`) and show the message that just arrived — the Claude-generated summary of the input
text.

## 6. Query the run history (~30s)

```bash
curl http://localhost:3001/workflow-runs -H "Authorization: Bearer $TOKEN"
```

Say: "Every run is fully recorded — status, timestamps, and each step's individual result — and
this list can only ever contain the demo account's own runs." Point out the `stepResults` array:
Trigger, then AI, then Destination, each with its own `durationMs`.

```bash
curl http://localhost:3001/workflow-runs/<id-from-the-list-above> -H "Authorization: Bearer $TOKEN"
```

Say: "And here's the detail view for one specific run — this is what a failed run looks like too:
it stops at the failing step and tells you exactly why, instead of failing silently."

## Done

Total: webhook in, Slack message out, full history queryable — under two minutes, matching the
release's own [Demo Rule](../../CONTRIBUTING.md).
