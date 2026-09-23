# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Paseo users who run several coding-agent threads at once and need to see where their attention is required without opening each workspace.

## Product Purpose

Thread Board provides a host-wide operational view of Paseo threads. Success means a user can open one surface, identify work that needs attention, see what is running or intentionally paused, and jump directly to the relevant thread.

## Positioning

Unlike a task tracker, Thread Board projects live Paseo agent state directly into Kanban and list
views. It adds only one manual workflow decision—Pause—and automatically invalidates that decision
when new thread activity arrives.

## Operating Context

The plugin runs inside Paseo and reads the host's agent, workspace, and project snapshots. Users scan it repeatedly while concurrent threads and subagents run across projects.

## Capabilities and Constraints

- A Paseo workspace appears as a parent when it has multiple top-level agent tabs. Each tab remains
  visible as a child item in its own live-state lane; subagents stay separate from the tab count.
- The lanes are Needs You, Running, and Paused. Finished and failed turns remain in Needs You until
  the user sends a follow-up or explicitly pauses them. Viewing a thread never addresses it.
- Pause is manual for attention-demanding work. A later prompt, run, completion, error, or
  permission request automatically releases it.
- A thread is stale when no user message has been sent for seven days. Viewing a thread does not
  affect this clock. Stale is an age attribute rather than a lane: unresolved stale work remains
  visible in Needs You, while paused stale work is hidden by default.
- Top-level threads are shown by default. Users can include subagents; top-level cards show their subagent count.
- Users can switch between Kanban and a searchable, state-filterable list. The list keeps each
  multi-tab parent adjacent to its matching child tabs and preserves the parent as context when a
  filter matches only a child. View mode, Show subagents, Show stale, sticky attention, and Pause
  records are persisted as host-backed plugin settings; search text and state filters are transient.
- Users can ask a temporary `codex/gpt-5.6-luna` child agent to propose clear names for every active
  top-level thread/tab and multi-tab workspace parent. Generation runs in the background so the
  board and Paseo remain usable. The job and its completed proposals survive leaving and reopening
  the Thread Board surface within the Paseo client session, then expose an explicit Review action
  when the full set is ready. Reviewed names are persisted as host-backed Thread Board aliases and
  can be restored to the original Paseo names. Existing native agent-tab titles remain unchanged
  because the public Paseo plugin SDK does not expose title updates for existing agents.
- Selecting a thread parent opens its most urgent tab; selecting a child opens that exact Paseo tab.
  Stale tab cards can also be archived after confirmation.
- Right-clicking a card on desktop or long-pressing it on touch opens actions for that exact parent,
  tab, or thread. Eligible Needs You work exposes Pause there; stale concrete threads also expose
  the confirmed Archive flow.
- Archived means closed for this board: archived threads leave the board and remain available through Paseo's archive/history surfaces.
- Lane placement combines Paseo runtime state with the persisted attention/Pause record. There is
  no drag-and-drop or general-purpose task database.
- The client must update from Paseo's live subscriptions and work on compact and wide layouts.
- The plugin targets the Paseo 0.9.1 plugin API.

## Brand Commitments

The product name is Thread Board. It is a native Paseo surface and inherits Paseo's visual and interaction language.

## Evidence on Hand

Paseo agent snapshots expose status, attention reason, workspace, project, provider, model, activity time, labels, and parent-thread relationships. No customer claims, usage metrics, or bespoke visual assets exist and none should be fabricated.

## Product Principles

- Keep the manual workflow layer limited to acknowledging work with Pause.
- Put attention-demanding work first.
- Roll a multi-tab thread up to its most urgent tab without flattening the individual tab states.
- Keep active work legible when many subagents are running.
- Make every card a short path back to the actual conversation.
- Keep secondary card actions available from both pointer and touch input without making the board
  depend on hover.
- Prefer a focused operational view over management controls; progressively disclose view options.
- Make AI-assisted bulk changes previewable, reversible, and explicit about their scope.

## Accessibility & Inclusion

Status must never rely on color alone. Controls and cards require readable labels, clear focus/pressed states, and touch-sized targets across supported Paseo clients.
