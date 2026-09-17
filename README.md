# Thread Board

A live Kanban and filterable list view of every coding-agent thread on a Paseo host.

Thread Board answers the operational question: **what is running, and what needs me?** Live Paseo
activity drives the board, with one deliberate workflow action for setting reviewed work aside.

## What it does

- Places live agent threads into **Needs You**, **Running**, and **Paused**.
- Keeps completed and failed turns in **Needs You** when you open or view them. They leave only when
  you send a follow-up or explicitly choose **Pause**.
- Automatically moves paused work back to Running or Needs You when a later prompt, run,
  completion, error, or permission request arrives.
- Groups top-level agent tabs from the same Paseo workspace under their workspace parent. The parent
  rolls up to the most urgent tab, while each child remains visible in its own live-state lane.
- Marks threads with no user message in the last seven days as **Stale**. Staleness is an age badge,
  not a lane: unresolved stale work remains in Needs You, while stale paused work is hidden by
  default. Merely opening a thread does not reset this clock.
- Offers Kanban and searchable list views, with state filters in the list. List results keep each
  multi-tab parent directly above its matching tabs, even when only a child matches the filter.
- Counts real thread destinations separately from virtual parents and clears search plus state
  filters in one action.
- Keeps **Show subagents** and **Show stale** in a compact **View options** menu.
- Adds **Rename board with Luna** to generate concise names for every active top-level thread, tab,
  and grouped parent. Generation continues in the background without blocking Thread Board or
  Paseo, including when you leave and reopen the plugin; an explicit **Review** action appears when
  the complete set is ready. You can restore the original names at any time.
- Opens card actions with right-click on desktop or long-press on touch. **Pause** lives in this
  menu for eligible Needs You work; stale threads also offer the same protected Archive flow.
- Persists view options, sticky attention, manual pauses, and Luna-generated board names in Paseo's
  host-backed plugin settings.
- Shows project, workspace, provider, model, attention reason, and recent activity on each card.
- Opens the most urgent tab when you select a thread parent, or the exact tab when you select a
  child.
- Archives stale threads from the board after confirmation; archived threads leave the board.
- Updates from Paseo's agent-directory subscription, with a 30-second refresh backstop.
- Uses full columns on wide clients and lane tabs on compact clients.

Lane placement combines the thread's real runtime state with its acknowledged board state; cards
cannot be dragged between lanes. Paused is the one manual state, and any new activity releases it.
Stale threads remain accessible until you explicitly archive them. Archived threads remain
available through Paseo's archive/history surfaces.

Thread grouping uses Paseo's stable workspace identity. A workspace with one top-level tab remains
an ordinary standalone thread. Subagents stay separate from the workspace's tab count, including
when the **Include subagents** toggle is on.

Generated names are aliases inside Thread Board. Paseo's public plugin API does not currently let a
plugin update the native title of an existing agent tab, so the sidebar and conversation header keep
their original titles. The naming helper runs as a temporary Luna child agent using only board title,
project, workspace, and sibling context; it is archived after the naming run.

## Lane rules

| Lane | Rule |
| --- | --- |
| Needs You | Permission requested, error, or finished turn not yet followed up or paused |
| Running | `running` or `initializing` |
| Paused | No current activity, or a completed/failed turn you explicitly paused |

**Stale** is an additional badge for seven days without a user message. A stale Needs You item stays
visible; **Show stale** reveals paused stale items.

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

Git installs run no package manager. Thread Board has no external API or analytics. Its small server
entry point registers host-backed view, workflow, and name-alias settings; thread data and the Luna
naming helper still use Paseo's public client API.

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
