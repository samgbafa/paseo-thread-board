# Thread Board

A live Kanban view of every coding-agent thread on a Paseo host.

Thread Board answers the operational question: **what is running, and what needs me?** It derives
each card's lane directly from Paseo, so there is no second task status to maintain.

## What it does

- Places live agent threads into **Needs You**, **Running**, **Idle**, and **Stale**.
- Treats threads with no update in the last seven days as Stale and keeps them hidden by default.
- Shows top-level threads by default, with a subagent count and an **Include subagents** toggle.
- Shows project, workspace, provider, model, attention reason, and recent activity on each card.
- Opens the real Paseo thread when you select a card.
- Archives stale threads from the board after confirmation; archived threads leave the board.
- Updates from Paseo's agent-directory subscription, with a 30-second refresh backstop.
- Uses full columns on wide clients and lane tabs on compact clients.

Lane placement reflects the thread's real runtime state and last update; cards cannot be dragged
into a state that Paseo does not have. Stale threads remain accessible until you explicitly archive
them. Archived threads remain available through Paseo's archive/history surfaces.

## Lane rules

| Lane | Paseo state |
| --- | --- |
| Needs You | Permission requested, error, finished turn awaiting review, or `requiresAttention` |
| Running | `running` or `initializing` |
| Idle | `idle` without an attention signal |
| Stale | No update for seven days, regardless of the prior runtime state |

## Install

Thread Board requires Paseo 0.8.x. Paseo plugins are trusted code; inspect a plugin before
installing it.

```bash
paseo plugin add samgbafa/paseo-thread-board
```

Open **Thread Board** from the sidebar or search for **Open Thread Board** in the Command Center.

Update or remove it with:

```bash
paseo plugin update thread-board
paseo plugin remove thread-board
```

Git installs run no package manager. Thread Board has no server entry point, runtime dependency,
external API, analytics, or persistence; it reads the selected host through Paseo's client API.

## Develop

```bash
npm ci
npm run check
npm run typecheck
npm test
npm run build:preview
```

Run the responsive sample-data preview with `npm run dev:preview`. To try a local checkout in
Paseo:

```bash
paseo plugin install "$PWD"
paseo plugin reload thread-board
```

## Prior art

Thread Board was informed by the Paseo community's
[Agent Monitor](https://github.com/omercnet/paseo-plugins/tree/main/agent-monitor),
[GitHub Board](https://github.com/gpambrozio/paseo-plugins/tree/main/github-board), and
[Agents Dash](https://github.com/panrafal/paseo-plugins/tree/main/agents-dash-list). Agent Monitor's
host-wide triage semantics and GitHub Board's responsive lanes were especially useful references.
No existing plugin found during development combined live thread state with this focused Kanban
workflow.

## License

MIT
