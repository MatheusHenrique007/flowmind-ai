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
pnpm seed                 # creates the demo Workflow: webhook -> Claude -> Slack
pnpm --filter @flowmind/api dev
```

Say: "This is FlowMind AI — one hardcoded workflow, wired end to end: a webhook trigger, an AI
step through Claude, and a Slack notification. No visual editor yet — this release proves the
engine works."

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
and Slack credentials are even configured."

## 3. Execute the workflow (~30s)

```bash
curl -X POST http://localhost:3001/webhooks/webhook-to-slack-demo \
  -H "Content-Type: application/json" \
  -d '{"text":"Customer reported a checkout error and needs urgent help."}'
```

```json
{ "accepted": true }
```

Say: "That's it from the caller's side — the request is queued and returns immediately. A BullMQ
Worker picks it up, runs the Engine, calls Claude, and posts to Slack."

## 4. Show the Slack message (~15s)

Switch to the Slack channel the demo workflow posts to (`SLACK_CHANNEL` in `.env`, default
`#alerts`) and show the message that just arrived — the Claude-generated summary of the input
text.

## 5. Query the run history (~30s)

```bash
curl http://localhost:3001/workflow-runs
```

Say: "Every run is fully recorded — status, timestamps, and each step's individual result." Point
out the `stepResults` array: Trigger, then AI, then Destination, each with its own `durationMs`.

```bash
curl http://localhost:3001/workflow-runs/<id-from-the-list-above>
```

Say: "And here's the detail view for one specific run — this is what a failed run looks like too:
it stops at the failing step and tells you exactly why, instead of failing silently."

## Done

Total: webhook in, Slack message out, full history queryable — under two minutes, matching the
release's own [Demo Rule](../../CONTRIBUTING.md).
