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
 * - below md: sidebar hidden, two rows: editor+operation side-by-side
 *   (1fr/1fr), response on its own row below. Keeps the playground
 *   usable on narrow viewports without re-architecting the desktop
 *   layout.
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
        grid min-h-0
        grid-cols-2 grid-rows-[1fr_1fr]
        [grid-template-areas:'editor_ops''response_response']
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
