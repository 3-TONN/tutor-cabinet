---
name: Кабинет репетитора
description: ЕГЭ по информатике — учёт занятий, программы, оплат и материалов в мире кодовой таблицы
colors:
  ink: "#000000"
  paper: "#ffffff"
  surface: "#ffffff"
  mist: "#f3f3f5"
  line: "#dedee2"
  graphite: "#66666e"
  signal: "#d92d20"
  accent: "#2340ff"
  on-accent: "#ffffff"
  ink-dark: "#ededf0"
  paper-dark: "#060608"
  surface-dark: "#121216"
  mist-dark: "#1e1e24"
  line-dark: "#303038"
  graphite-dark: "#a0a0aa"
  signal-dark: "#ff6b5e"
  accent-dark: "#788cff"
  on-accent-dark: "#060608"
typography:
  display:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  display-numeral:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "1.375rem"
  body:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.375rem"
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.125rem"
  mono-label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.125rem"
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
rounded:
  tag: "6px"
  field: "16px"
  container: "20px"
  glass: "28px"
  pill: "9999px"
spacing:
  hairline: "1px"
  grid-cell: "40px"
  grid-major: "160px"
  gutter-mobile: "16px"
  gutter-desktop: "32px"
  container-pad: "20px"
  stat-pad: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-sm:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.mist}"
  button-danger:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 14px"
  card-boxed:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.container}"
    padding: "{spacing.container-pad}"
  stat-tile:
    backgroundColor: "{colors.paper}"
    typography: "{typography.headline}"
    padding: "{spacing.stat-pad}"
  badge-done:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-neutral:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  nav-item:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
  chart-header-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.mono-label}"
    height: "28px"
  kind-tag-code:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.tag}"
    height: "24px"
    padding: "0 6px"
---

# Design System: Кабинет репетитора

## Overview

**Creative North Star: "The Code Page"**

Everything in the cabinet has an address, like a glyph in a character encoding. Course topics are cells of a code table with hex addresses, today's lessons are cells of a strip, and summaries are tiles of a mosaic laid on 1px lines. The ground is white paper (pure black ink on it) ruled with a faint code-table grid; above that ground float a few panels of liquid glass, refractive and rim-lit, reserved for the things that move with the user: the sidebar, the mobile tab bar, modals, and the live readout of the course map.

The world is monochrome by doctrine. Rank comes from weight and inversion (a black band, a black cell, a black badge), not from hue. One ultramarine marks selection, the current thing, and the main action; one signal red marks money owed, overdue work, and destruction. Numbers (times, money, scores, addresses) are the primary information and are always set in a monospaced, tabular face. The density is that of a working tool: tight mosaics, hairline separators, sections opened by a rule rather than boxed in cards.

The system explicitly rejects the SaaS kit of identical shadowed cards with coloured icon plates. Paper surfaces lie flat; only glass casts a shadow.

**Key Characteristics:**
- White paper, pure black ink, a 40px code-table grid with every 4th line denser (160px).
- Ultramarine only for selection, current state and the primary action; signal red only for debt, overdue and delete.
- Three text sizes (13 / 15 / 28), plus two display uses: the page date and today's lesson times.
- Onest for text, JetBrains Mono for every number and address.
- Inverse black header bands with mono codes, as on a code chart.
- Liquid glass for floating chrome only; everything on the paper is flat and ruled with 1px lines.
- Status is read by shape (fill, outline, dashed, hatch, strike-through), never by a per-student colour.

## Colors

A two-ink world on white paper, with one cold accent and one warm alarm; the dark theme swaps paper for near-black and ink for a soft off-white rather than pure white.

### Primary
- **Code-Point Ultramarine** (accent; dark: accent-dark): primary buttons, the active nav pill, active Segmented option, Tabs underline, focus outline and caret, text selection, the focused cell ring on the course map, the "next topic" ring, hex addresses in the readout, numbers and keywords in the code viewer, link-type file tags.
- **On-Ultramarine** (on-accent): text and icons sitting on ultramarine. In dark it becomes near-black, because the dark accent is lightened.

### Secondary
- **Signal Red** (signal; dark: signal-dark): debt, overdue homework, no-show lessons, topics that require review, destructive buttons, error toasts, string literals in the code viewer. As a tint it appears at 10–15% fill with a 30–40% ring.

### Neutral
- **Pure Ink** (ink; dark: ink-dark): body text, the inverse header bands of the course chart, mastered cells, done lesson chips, done badges, avatars, the brand `{}` mark, the current lesson cell in the Today strip, block-end ticks, table head rules, the frame of the course chart and Today strip.
- **Paper** (paper; dark: paper-dark): page ground, field fill, boxed card fill, stat tile fill, table fill, code-viewer body.
- **Surface** (surface; dark: surface-dark): popovers (MultiPick list), planned lesson chips, and the solid fallback for glass under reduced transparency.
- **Mist** (mist; dark: mist-dark): hover fills for ghost controls, neutral badges, the empty trailing cells of the chart, cancelled chips, progress track.
- **Hairline** (line; dark: line-dark): every 1px rule, divider, mosaic gap, field stroke, cell border.
- **Graphite** (graphite; dark: graphite-dark): secondary text, labels, placeholders, inactive tabs and nav labels.
- Glass and grid are tokenised as CSS custom properties (`--glass-tint`, `--glass-alpha` 0.58 light / 0.55 dark, `--glass-rim`, `--grid-line`, `--grid-alpha` 0.055 light / 0.06 dark); see the sidecar.

### Named Rules
**The One Ultramarine Rule.** Ultramarine means "selected, current, or do this". It is never decoration, never a section colour, never a chart series fill.

**The Red Means Money Rule.** Signal red is spent only on debt, overdue, no-show, review-needed and delete. If nothing is wrong, the screen has no red.

**The Shape Not Hue Rule.** State is read by form: filled ink = done or mastered, ink outline = planned or assigned, dashed outline = needs attention, hatch = in progress, strike-through on mist = cancelled. Legacy palette names (brand, slate, gray, amber, emerald, teal, sky, violet) are aliased to the neutral scale and rose to signal, so old colour classes cannot carry meaning.

## Typography

**Display Font:** Onest (with system-ui, sans-serif)
**Body Font:** Onest (with system-ui, sans-serif), stylistic sets ss01 and cv11 on
**Label/Mono Font:** JetBrains Mono 400/500/600 (with ui-monospace, monospace)

**Character:** A plain, slightly rounded Cyrillic grotesque for words, a programmer's mono for everything countable. The pairing reads like source code with comments: text explains, mono states the facts.

### Hierarchy
- **Display** (Onest 700, 2rem rising to 2.75rem at sm, line-height 1.05, -0.04em): the page header only; on the dashboard it is the date.
- **Display numeral** (JetBrains Mono 500, 2.75rem rising to 3.25rem, line-height 1): lesson start times in the Today strip only.
- **Headline** (JetBrains Mono 500, 28px, line-height 1, -0.02em, tabular): stat values in the mosaic.
- **Title** (Onest 600, 15px): section headings, card titles, button and nav labels (500). Modal titles are 15px at 700.
- **Body** (Onest 400, 15px / 22px): all running text, field values.
- **Label** (Onest 500, 13px / 18px): hints, badges, legends, table heads, secondary metadata.
- **Mono label** (JetBrains Mono 500, 13px, tabular): hex addresses, chart header codes, counts, durations, the code viewer body (13px / 24px).

### Named Rules
**The Three Sizes Rule.** Interface text uses 13, 15 and 28 only; Tailwind's xs maps to 13, sm through xl all map to 15, 2xl and 3xl map to 28. Rank beyond that comes from weight and inversion. The two display uses above are the only exceptions.

**The Mono For Facts Rule.** Every time, sum, score, count and address is set in JetBrains Mono with tabular numerals and -0.02em tracking (the `.num` utility). Prose is never set in mono.

## Layout

The page ground is a fixed code-table grid: 1px lines every 40px at grid-alpha, and every 160px at 1.8x that alpha, attached to the viewport so content scrolls over it. Content sits in a centered column (max 72rem) with 16px gutters on phones and 32px from sm; top padding 32px (48px at lg); bottom padding 128px on phones to clear the floating tab bar.

On desktop (lg, 1024px) a floating glass sidebar 17.25rem wide sits 12px from the top, left and bottom edges and the content is offset by 19rem. On phones it becomes a glass tab bar 12px from the sides and bottom (respecting the safe area) with four primary destinations plus "Ещё", which opens a glass bottom sheet with a 3-column grid of the remaining sections.

The dashboard's first row is a two-column grid (1.7fr / 1.15fr): the Today strip of lesson cells (each at least 16rem wide, basis 18rem, min height 10rem) and the summary mosaic. Below, the course chart.

### Named Rules
**The Hairline Mosaic Rule.** Groups of peers (stat tiles, today's lesson cells, chart cells) are separated by 1px gaps over a line- or ink-coloured backing, never by margins and shadows. The mosaic is clipped in a 20px-radius frame.

**The Open Section Rule.** A section is opened by a 1px top rule and a 52px header row, not by a box. A bordered box is reserved for an object that stands alone in a grid (a material, a test, a question).

## Elevation & Depth

Two layers only. The paper layer is completely flat: no shadows, depth by tonal fill and 1px rules. The glass layer floats above it: a vertical gradient of the glass tint (alpha +0.14 at top to -0.06 at bottom), backdrop blur 18px with 185% saturation and 1.04 contrast, a bright inner top rim, a faint inner bottom edge, a 1px inner rim, and a soft drop shadow; a radial soft-light highlight sits in the upper third. `glass-strong` raises alpha to 0.72 for modals and sheets. Modal scrims are black at 35%.

### Shadow Vocabulary
- **Glass, light** (`box-shadow: inset 0 1px 0 0 rgb(255 255 255 / 0.85), inset 0 -1px 0 0 rgb(0 0 0 / 0.06), inset 0 0 0 1px rgb(255 255 255 / 0.28), 0 12px 32px -12px rgb(0 0 0 / 0.22), 0 2px 6px -2px rgb(0 0 0 / 0.08)`): sidebar, tab bar, readout, modals, sheets.
- **Glass, dark** (`box-shadow: inset 0 1px 0 0 rgb(255 255 255 / 0.22), inset 0 -1px 0 0 rgb(0 0 0 / 0.4), inset 0 0 0 1px rgb(255 255 255 / 0.09), 0 14px 36px -12px rgb(0 0 0 / 0.7)`): the same panels in the dark theme.

### Named Rules
**The Glass Floats, Paper Lies Flat Rule.** Only glass casts a shadow, and glass is only for chrome that floats over content: navigation, modals and sheets, the live readout. Cards, tiles, tables and fields never get a shadow.

**The Reduced Transparency Rule.** Under `prefers-reduced-transparency: reduce` glass becomes solid surface with no blur and no highlight. Any new glass panel must inherit this.

**The Legible Core Rule.** Glass frames reading content, it does not sit behind it: long-form content inside a glass modal (the code viewer) is set on an opaque paper panel with a 1px line. This is an accepted adaptation, not an exception to remove.

## Shapes

Controls are pills (buttons, nav items, Segmented, badges, toasts, icon buttons). Fields and popovers use 16px corners; boxed cards, the stat mosaic, the Today strip and the course chart frame use 20px; glass panels use 28px (the tab bar 1.75rem, modals 28px, top corners only on phones as a bottom sheet). Small mono tags (file kind) use 6px. Chart cells are square-cornered inside their rounded frame; legend swatches are 2px. Borders are always 1px; the course chart and Today strip are framed in ink rather than line to mark them as the primary instruments. The block-end tick is a 3px ink bar on a cell's right edge.

## Components

### Buttons
Quiet, confident pills; colour is reserved for intent.
- **Shape:** full pill; 44px tall (md) or 36px (sm), 20px / 14px side padding, 18px icon with 8px gap, 15px medium label.
- **Primary:** ultramarine fill, on-accent text; hover 90%, active 80%.
- **Secondary:** paper fill, ink text, inset 1px ring at ink 25%, ring goes full ink on hover.
- **Ghost:** ink text, mist fill on hover. **Icon button:** 40px circle, graphite icon, mist hover.
- **Danger:** signal fill, white text; used for delete confirmations.
- **Focus / Disabled:** global 2px ultramarine outline, 2px offset; disabled at 40% opacity. Colour transitions 150ms.

### Chips (status vocabulary)
- **Badge:** 13px medium pill, 2px 10px. Done = ink fill, paper text. Planned / assigned = inset ink ring at 50%. Attention = dashed 1px ink-50% border. Neutral = mist fill, graphite text. Code = mist with mono text. Money / overdue = signal at 10% fill, signal text, 30% ring.
- **Lesson chip (calendar):** done = ink fill; planned = surface with ink-40% ring; ended but unmarked = surface with dashed ink border; no-show = signal tint; cancelled = mist, graphite, struck through.
- **File kind tag:** 24px mono tag, 6px radius. Code files inverse (ink fill); links ultramarine text and ring; documents ink ring at 40%.

### Cards / Containers
- **Open section (default):** 1px line on top, 52px header with 15px semibold title, no fill, no radius.
- **Boxed:** 20px radius, paper fill, 1px line border, 20px padding, flat.
- **Stat mosaic:** 2 columns (4 at lg) of paper tiles over a line backing with 1px gaps, 20px radius frame; tile = 15px graphite label, 28px mono value (signal when bad), 13px sub.
- **Empty state:** centered, a 48px line-ringed circle with a graphite icon, title, 15px graphite text, optional action.

### Inputs / Fields
- **Style:** paper fill, 1px line border, 16px radius, 10px 14px padding, 15px text, graphite placeholder; hover border ink 40%.
- **Focus:** border becomes ultramarine with a 2px ultramarine ring at 25%.
- **Disabled:** 60% opacity. Label above in 15px medium ink, hint below in 13px graphite. Checkboxes use ink as accent colour.

### Navigation
- **Sidebar:** glass, 28px radius, floating. Brand lock-up: a 40px ink square (12px radius) with a mono `{}` and the two-line name. Items: 40px pills, 15px medium, 18px icon; inactive ink 80% with ink-6% hover fill; active ultramarine pill with on-accent text. Groups split by a 1px line.
- **Mobile tab bar:** glass, 1.75rem radius, 5 columns; each item an icon in a 32px x 56px pill that turns ultramarine when active, label below.
- **Tabs:** underline tabs on a 1px line, 2px ultramarine underline on the active tab, mono counts in graphite; horizontally scrollable with an edge fade on phones.
- **Segmented:** pill track on paper with an inset line ring; active option is an ultramarine pill.

### Tables
Paper ground, 15px rows divided by 1px lines, head row in 13px graphite medium over a full ink rule.

### Modal
Glass-strong panel, 28px radius (top corners only as a phone bottom sheet), max 32rem or 48rem wide, 92vh max height; 24px padding, title 15px bold with a close icon button, footer separated by a 1px line with right-aligned actions.

### Course Chart (signature)
The code chart of the course. A grid framed in ink with a 2.75rem row-address column and 16 columns (8 when the container is under 760px, an accepted mobile adaptation; row addresses step with the grid). Column and row headers are inverse ink bands, 28px tall, with mono hex codes in paper. Each cell (56px tall, 48px on 8 columns) shows its two-digit hex address top-left and the score bottom-right, both mono at 13px; fill follows the topic status (not started = line ring, graphite; in progress = hatch with ink-50% ring; passed = ink 25%; review = signal 15% with signal ring; mastered = ink fill). The next topic carries a 2px ultramarine ring at 70%. Hover or focus dims all other cells to 35% opacity over 200ms and raises the focused cell with a 3px inset ultramarine ring; click pins it. Arrow keys move by cell and row. Below sits a sticky glass readout that prints address, topic, block, status and last lesson, or the overall progress when nothing is focused. Cells fade in by address (`cell-in`, 420ms, cubic-bezier(0.16, 1, 0.3, 1), 6ms stagger capped at 96 cells).

### Today Strip (signature)
Lesson cells in an ink-framed mosaic with 1px ink gaps. Each cell carries the display-numeral start time, mono end time, student name and status line. The live lesson (or, if none, the next one) is inverse: ink fill, paper text, a paper "Провести" pill. A lesson that ended unmarked gets the ultramarine "Провести"; others get the secondary ring pill.

### Code Viewer
A wide glass modal whose title carries the file kind tag. The body is an opaque paper panel with a 1px line and 16px radius: mono 13px / 24px, a graphite line-number gutter separated by a 1px rule, rows highlighted at ultramarine 6% on hover. Syntax: keywords and numbers ultramarine, strings signal, comments graphite italic, builtins underlined at ink 25%.

## Do's and Don'ts

### Do:
- **Do** set every number, time, sum, score and hex address in JetBrains Mono with tabular numerals (`.num`).
- **Do** express rank with weight and inversion: an ink band, an ink cell, an ink badge.
- **Do** separate peers with 1px gaps over a line or ink backing inside a 20px frame.
- **Do** reserve ultramarine for selection, the current item and the single primary action on a screen.
- **Do** read status by shape: fill, ring, dashed, hatch, strike-through.
- **Do** use glass only for floating chrome (navigation, modals, sheets, live readouts), and set long reading content on opaque paper inside it.
- **Do** keep both themes working through the RGB-triplet custom properties; never hard-code a hex in a component.
- **Do** keep pill controls at least 40px tall (44px for main buttons) for phone use.

### Don't:
- **Don't** build screens from identical shadowed cards with coloured icon plates.
- **Don't** put a shadow on paper surfaces: cards, tiles, tables, fields.
- **Don't** use signal red for anything except debt, overdue, no-show, review-needed and delete.
- **Don't** use ultramarine as decoration, a section colour, or a chart series fill.
- **Don't** introduce a text size outside 13 / 15 / 28 beyond the page date and today's lesson times.
- **Don't** give students or categories their own colours; avatars are ink circles with initials.
- **Don't** add authored animations beyond the course-chart `cell-in`; state changes are short colour or opacity transitions, and all motion collapses under `prefers-reduced-motion`.
