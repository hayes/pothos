import type { ReactNode } from 'react';

interface Props {
  /** Schema sidebar pane (md+ only). */
  sidebar: ReactNode;
  /** Schema editor pane (Monaco TS / SDL viewer). */
  editor: ReactNode;
  /** Operation pane (query/variables/headers/context tabs). */
  ops: ReactNode;
  /** Response pane (rendered below ops on md+, in its own row below md). */
  response: ReactNode;
}

/**
 * Grid container for the playground's main work area.
 *
 * Layout rules:
 * - md+ (>=768px): three columns [sidebar 280px | editor 1fr |
 *   (operation+response stacked) 1fr].
 * - below md: a single column with the panes stacked vertically —
 *   editor, then operation, then response. Two ~175px side-by-side
 *   columns are unusable on a phone (Monaco needs real width), so the
 *   narrow layout stacks full-width panes the user scrolls through.
 *
 * Width containment: the root grid AND every pane wrapper carry
 * `min-w-0`. Without it a grid item defaults to `min-width:auto` =
 * Monaco's min-content (~800px), which blows the whole shell past the
 * viewport and forces whole-page horizontal scroll on phones/tablets
 * and inside the docs "Open in Playground" iframe.
 *
 * Each pane wrapper is itself a `grid` (single 1fr row) so its child
 * stretches to fill the cell. A previous `block` wrapper left Monaco's
 * `height="100%"` resolving against an auto-height block child,
 * collapsing the editors to 0.
 */
export function PlaygroundLayout({ sidebar, editor, ops, response }: Props) {
  return (
    <div
      className="
        grid min-w-0 min-h-0
        grid-cols-1 grid-rows-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]
        [grid-template-areas:'editor''ops''response']
        md:grid-cols-[280px_1fr_1fr] md:grid-rows-1
        md:[grid-template-areas:'sidebar_editor_ops']
      "
    >
      <div className="hidden md:grid md:grid-rows-[1fr] min-h-0 [grid-area:sidebar]">{sidebar}</div>

      <div className="grid grid-rows-[1fr] min-w-0 min-h-0 [grid-area:editor]">{editor}</div>

      <div className="grid grid-rows-[1fr] min-w-0 min-h-0 [grid-area:ops] md:grid-rows-[1fr_1fr]">
        {ops}
        {/* On md+ the response sits below the operation pane (stacked grid).
            Below md it lives in its own grid row via [grid-area:response]. */}
        <div className="hidden md:grid md:grid-rows-[1fr] min-h-0">{response}</div>
      </div>

      <div className="grid grid-rows-[1fr] min-w-0 min-h-0 [grid-area:response] md:hidden">
        {response}
      </div>
    </div>
  );
}
