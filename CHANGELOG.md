# Changelog

## 0.7.0 — 2026-09-16

- Add card action panels opened by right-click on desktop or long-press on touch clients.
- Move Pause into the contextual action panel while keeping ordinary card activation focused on
  opening the thread.
- Offer Open and eligible stale-thread Archive actions from the same panel, with Archive still
  requiring confirmation.

## 0.6.0 — 2026-09-16

- Replace Idle with an explicit Paused workflow state.
- Keep finished and failed work in Needs You after opening or viewing its Paseo thread.
- Add Pause actions for individual threads, tabs, and eligible multi-tab parents.
- Automatically release Pause when a new prompt, run, completion, error, or permission request
  arrives.
- Treat Stale as an age badge and visibility filter so unresolved old work remains in Needs You.
- Persist attention acknowledgements and pauses in host-backed plugin settings.

## 0.5.0 — 2026-09-16

- Keep multi-tab thread parents and their matching child tabs together in List view.
- Preserve parent context when a search or state filter matches only a child tab.
- Add accurate result counts and one-action filter clearing without counting virtual parents as
  threads.

## 0.4.0 — 2026-09-15

- Consolidate Show subagents and Show stale into a compact View options menu.
- Add a searchable list view with state filters alongside the Kanban board.
- Persist the selected view and visibility options in Paseo's host-backed plugin settings.

## 0.3.1 — 2026-09-14

- Group top-level tabs by their shared Paseo workspace parent instead of their provider session,
  while keeping subagents separate from the tab count.

## 0.3.0 — 2026-09-14

- Group Paseo agent tabs that share one provider-native thread under a canonical parent.
- Roll the parent into the most urgent child state while keeping every child tab in its own lane.
- Make parent and child destinations explicit: parents open the urgent tab and children open their
  exact Paseo tab.

## 0.2.1 — 2026-09-14

- Base activity age, Stale classification, and lane sorting on Paseo's last user-message time so
  opening a thread does not make it recent.

## 0.2.0 — 2026-09-14

- Replace Closed with a seven-day Stale lane while keeping stale threads accessible.
- Add a confirmed Archive action to stale cards with progress, error, and success feedback.

## 0.1.0 — 2026-09-14

- Add a host-wide live thread board with Needs You, Running, Idle, and Closed lanes.
- Add top-level-by-default presentation with optional subagents and Closed history.
- Add direct card-to-thread navigation and adaptive wide/compact layouts.
