# @flowmind/destinations-slack

`SlackDestination` — implements the `Destination` port (`@flowmind/destinations-contracts`) via a
direct `fetch` call to Slack's `chat.postMessage` Web API endpoint. No `@slack/web-api`
dependency; a single authenticated POST is all this release needs.
