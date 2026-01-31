# ADR 001: CSS Grid instead of HTML table for word list

## Status
Accepted

## Context
The word list uses virtualization (`@tanstack/react-virtual`) for performance with 5000+ rows. Virtualization requires `display: block` on `<tbody>` with absolutely-positioned rows. To maintain column widths, `<thead>` and each `<tbody> <tr>` were set to `display: table; width: 100%`, making them independent table layout contexts.

This caused column misalignment: the header and body rows computed column widths independently, leading to ~15px discrepancies between header cells and body cells. The problem was most visible on narrower viewports.

Attempted fixes that failed:
- `table-layout: fixed` — forced equal widths but made columns too narrow for content
- Fixed pixel widths on `.col-*` classes — overridden by the table layout algorithm
- `!important`, `min-width` + `max-width` — table cells treat `width` as a suggestion, not a constraint

## Decision
Replace `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<th>` / `<td>` with `<div>` elements using CSS Grid (`display: grid`) and ARIA roles (`role="table"`, `role="row"`, `role="columnheader"`, `role="cell"`).

Each row uses the same `grid-template-columns` value computed from visible columns, passed as an inline style. Column widths use `minmax(Xpx, Y%)` to set a minimum pixel width while scaling proportionally on larger viewports.

## Consequences

### What we gain
- **Guaranteed column alignment** — header and body rows share the same grid track sizing regardless of content
- **Dynamic column visibility** — toggling columns off recalculates `grid-template-columns` from `getVisibleFlatColumns()`, so remaining columns redistribute space automatically
- **No display hacks** — no more `display: block` / `display: table` overrides that fought the browser's table layout algorithm

### What we lose
- **Native table semantics** — mitigated by ARIA roles, which screen readers interpret equivalently
- **Native table features** — `colspan`, `rowspan`, `caption`, `colgroup` are unavailable, but none were in use
- **Auto column sizing** — table cells auto-size to content; grid requires explicit `minmax()` values that may need tuning if column content changes significantly
