# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Paseo users who run several coding-agent threads at once and need to see where their attention is required without opening each workspace.

## Product Purpose

Thread Board provides a host-wide operational view of Paseo threads. Success means a user can open one surface, identify work that needs attention, see what is running or idle, and jump directly to the relevant thread.

## Positioning

Unlike a task tracker, Thread Board projects live Paseo agent state directly into a Kanban view. The board does not create a second workflow state or require users to keep cards synchronized with their threads.

## Operating Context

The plugin runs inside Paseo and reads the host's agent, workspace, and project snapshots. Users scan it repeatedly while concurrent threads and subagents run across projects.

## Capabilities and Constraints

- A provider-native thread appears once as a parent when Paseo has multiple agent tabs for it.
  Each tab remains visible as a child item in its own live-state lane.
- The lanes are Needs You, Running, Idle, and Stale.
- A thread is stale when no user message has been sent for seven days. Viewing a thread does not
  affect this clock. Stale is hidden by default.
- Top-level threads are shown by default. Users can include subagents; top-level cards show their subagent count.
- Selecting a thread parent opens its most urgent tab; selecting a child opens that exact Paseo tab.
  Stale tab cards can also be archived after confirmation.
- Archived means closed for this board: archived threads leave the board and remain available through Paseo's archive/history surfaces.
- Lane placement is derived from Paseo state. There is no drag-and-drop and no independent task database.
- The client must update from Paseo's live subscriptions and work on compact and wide layouts.
- The plugin targets the Paseo 0.8 plugin API.

## Brand Commitments

The product name is Thread Board. It is a native Paseo surface and inherits Paseo's visual and interaction language.

## Evidence on Hand

Paseo agent snapshots expose status, attention reason, workspace, project, provider, model, activity time, labels, and parent-thread relationships. No customer claims, usage metrics, or bespoke visual assets exist and none should be fabricated.

## Product Principles

- Reflect live thread truth rather than inventing parallel workflow state.
- Put attention-demanding work first.
- Roll a multi-tab thread up to its most urgent tab without flattening the individual tab states.
- Keep active work legible when many subagents are running.
- Make every card a short path back to the actual conversation.
- Prefer a focused operational view over management controls.

## Accessibility & Inclusion

Status must never rely on color alone. Controls and cards require readable labels, clear focus/pressed states, and touch-sized targets across supported Paseo clients.
