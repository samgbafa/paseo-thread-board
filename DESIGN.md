# Thread Board design

Thread Board is a quiet operational surface inside Paseo. It reflects live thread truth and avoids
the ceremony of a second task tracker.

## Visual language

- Inherit every color from Paseo's theme tokens. Never derive translucent colors from token strings.
- Keep the page chrome light: one header with **Rename board with Luna**, a single View options
  disclosure, and Refresh, then the live data. On compact clients the rename action gets its own
  full-width row so the title and utility controls keep room to breathe. View options groups the
  Kanban/List choice with Show subagents and Show stale checkboxes.
- Use the status dot as a quick scan aid, always paired with a written state label.
- Give a Paseo workspace with multiple top-level agent tabs one visually emphasized roll-up parent,
  regardless of differing provider persistence or session handles. Name it from `workspaceName`,
  with `projectName` as its fallback. The parent counts only those top-level tabs; subagents sharing
  its `workspaceId` remain standalone items and never increment that count. Each child says
  `Tab of <workspace parent>` so the hierarchy remains explicit without relying on indentation alone.
- Keep every card directly openable to the underlying Paseo thread. Stale cards add a secondary,
  protected Archive action.
- Give completed and failed cards a contextual Pause action. Right-click opens the action panel on
  desktop and long-press opens the same panel on touch. Opening the card never changes its board
  state; Pause is the explicit acknowledgement.
- Treat Luna naming as a protected, non-blocking bulk task. A host-owned modal explains the
  board-local boundary and reports exactly how many tabs and grouped parents will be named, then
  closes as soon as generation starts. Inline board status reports progress, readiness, or failure;
  Review opens only when requested and previews every old-to-new pair before applying the complete
  validated set. Restore originals remains available whenever saved aliases exist.

## Responsive behavior

- Wide layouts show the visible lanes together, with independently virtualized vertical lists.
- Compact layouts show horizontally scrollable status tabs and one virtualized lane at a time.
- List mode uses one searchable, virtualized column with horizontally scrollable state filters.
  Attention-demanding parents come first, each directly followed by its matching child tabs. A
  child-only filter result retains its parent for context, while counts exclude that virtual parent.
  Search spans thread, workspace, project, provider, and model; one action clears search and state.
- Place a multi-tab parent in the lane of its most urgent child while keeping each child tab in its
  own live-state lane. Activating the parent opens that urgent child; activating a child opens that
  exact Paseo tab. One current Paused and two stale Paused top-level tabs therefore produce one
  three-tab Paused parent; the two stale children appear when Show stale is enabled.
- The lanes are Needs You, Running, and Paused. A thread becomes stale at seven days or more since
  its last user message; metadata updates such as viewing a thread do not affect the clock. Stale is
  displayed as a secondary badge. Needs You overrides age, while paused stale and subagent threads
  remain opt-in so the first view emphasizes current top-level work.
- A new prompt, run, completion, error, or permission request releases a saved Pause. The new live
  state determines the destination lane.

## States and accessibility

- Loading, refresh, recoverable error, lane-empty, pressed, selected, pause-save,
  archive-confirmation, archive-progress, naming-progress, naming-preview, naming-error, and
  alias-save states must remain understandable in every Paseo theme.
- Allow one archive transaction at a time. Disable competing Archive controls until it settles;
  semantically disabled archive controls also use unmistakably reduced opacity. Success removes the
  card immediately, while failure retains it and presents a recoverable error.
- Never show Archive on a virtual roll-up parent. A stale concrete thread or tab retains the
  confirmed Archive action.
- Controls meet Paseo's native touch-target floor. Checkboxes, view selectors, state filters, and
  tabs expose checked or selected state, and compact tabs identify their controlled panel on web.
- A card's accessible name includes title, state, placement, provider/model, activity age, and child
  count; its hint explains that activation opens Paseo and that right-click or long-press reveals
  actions. The revealed action panel has a labeled close control and platform-sized touch targets.

## Do / don't

- Do sort within lanes by recent activity and put attention-demanding work first.
- Do let new Paseo runtime activity override a saved Pause automatically.
- Do keep the urgency-first parent, indented `Tab of …` children in their own lanes, and distinct
  subagent language.
- Do require confirmation before archiving an individual stale thread.
- Do keep generated names visually identical to ordinary names; their meaning matters more than an
  always-on AI badge.
- Don't keep a modal open while Luna works or automatically interrupt the user when results arrive.
- Don't offer Archive on a virtual roll-up parent.
- Don't add an Archived lane, destructive bulk actions, drag-and-drop, arbitrary editable states, a
  configurable stale threshold, analytics, or external persistence to this surface.
- Don't introduce a new palette or raster assets; Thread Board remains entirely within Paseo's theme
  tokens and native iconography.
- Don't hide status behind color, motion, hover, or platform-specific gestures.
