# Recording a 90-Second Demo Video

This is the recipe for the GIF/video that replaces `assets/demo-placeholder.svg` in the README.
For the narrated, step-by-step walkthrough of _what_ to say, see
[demo-script.md](demo-script.md) — this document is about _how to record it_ in ~90 seconds.

## Before recording

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY and SLACK_BOT_TOKEN for the full happy path —
# the recording is far more convincing with a real Slack message landing
docker compose up -d
pnpm seed
```

Open, ahead of time, so no waiting happens on camera:

- A terminal, large font (14pt+), dark theme, sized to ~100x30 so nothing wraps awkwardly.
- The Slack channel `SLACK_CHANNEL` points to (default `#alerts`), visible in another window or a
  second monitor/tab.
- Nothing else running on port 3001 (or set `PORT` in `.env` to something free).

Recording tool: [asciinema](https://asciinema.org/) for a terminal-only GIF (smallest file size,
easiest to convert), or [OBS Studio](https://obsproject.com/) / macOS's built-in screen recorder
if you want the Slack window in frame too. Convert to GIF with
[gifski](https://gif.ski/) or `ffmpeg` if your tool doesn't export GIF directly.

## The 90-second recording

| Time      | Action           | What's on screen                                                                                             |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| 0:00–0:10 | Run `pnpm demo`  | The command starts, prints "Checking required environment variables"                                         |
| 0:10–0:35 | Let it run       | Each step prints as it happens: Docker, Prisma sync, seed, API boot, health check                            |
| 0:35–0:45 | Webhook fires    | "Firing the webhook" → "Accepted — queued for execution"                                                     |
| 0:45–0:60 | Switch to Slack  | Cut to the Slack channel — the message from Claude's summary lands                                           |
| 0:60–0:75 | Back to terminal | The run finishes: "✔ Run ... finished with status SUCCEEDED", step results printed                           |
| 0:75–0:90 | Show the history | Run `curl http://localhost:3001/workflow-runs \| jq` in a second pane, or just let the printed history stand |

If `pnpm demo` alone doesn't leave enough time to show the Slack cut, run the steps from
[demo-script.md](demo-script.md) manually instead — it gives you control over pacing that a
single automated command doesn't.

## After recording

1. Trim dead air at the start/end.
2. Export as GIF, target under 8 MB (GitHub renders large GIFs slowly, some browsers refuse to
   autoplay huge ones). 800px wide is plenty for a README.
3. Replace `assets/demo-placeholder.svg` with the real file (`assets/demo.gif` or similar) and
   update the README's reference to point at it.
4. Do the same for static screenshots: `GET /health` and `GET /workflow-runs` responses, replacing
   `assets/screenshot-health-placeholder.svg` and `assets/screenshot-workflow-runs-placeholder.svg`.

## Why this is a separate document from demo-script.md

`demo-script.md` is the talk track for a _live_ demo (interview, presentation) — it assumes a
human is narrating in real time. This document is for producing a _static artifact_ (a GIF)
that ends up embedded in the README forever, which has different constraints: it needs to be
short, silent-friendly (no audio in a GIF), and paced for someone skimming, not watching live.
