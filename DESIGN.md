# Thread Board design

Thread Board is a quiet operational surface inside Paseo. It reflects live thread truth and avoids
the ceremony of a second task tracker.

## Visual language

- Inherit every color from Paseo's theme tokens. Never derive translucent colors from token strings.
- Keep the page chrome light: one header, two visibility controls, then the live lanes.
- Use the status dot as a quick scan aid, always paired with a written state label.
- Give cards one obvious action: open the underlying Paseo thread.

## Responsive behavior

- Wide layouts show the visible lanes together, with independently virtualized vertical lists.
- Compact layouts show horizontally scrollable status tabs and one virtualized lane at a time.
- Closed and subagent threads remain opt-in so the first view emphasizes active top-level work.

## States and accessibility

- Loading, refresh, recoverable error, lane-empty, pressed, selected, and disabled-by-absence states
  must remain understandable in every Paseo theme.
- Controls meet Paseo's native touch-target floor. Switches and tabs expose their checked or selected
  state, and compact tabs identify their controlled panel on web.
- A card's accessible name includes title, state, placement, provider/model, activity age, and child
  count; its hint explains that activation opens Paseo.

## Do / don't

- Do sort within lanes by recent activity and put attention-demanding work first.
- Do keep lane assignment derived from Paseo runtime state.
- Don't add drag-and-drop, editable task state, analytics, or external persistence to this surface.
- Don't hide status behind color, motion, hover, or platform-specific gestures.
