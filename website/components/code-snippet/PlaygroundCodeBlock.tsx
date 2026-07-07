'use client';

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { ExternalLink } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { PlaygroundOverlay } from './PlaygroundOverlay';

interface PlaygroundCodeBlockProps extends ComponentProps<typeof CodeBlock> {
  /**
   * Example ID to load in playground
   */
  exampleId?: string;

  /**
   * Whether to show "Open in Playground" button
   */
  playground?: boolean;

  /**
   * Raw code content
   */
  code?: string;

  /**
   * GraphQL query to pre-populate (opens to GraphQL view)
   */
  query?: string;

  /**
   * Data attributes from rehype plugin
   */
  'data-playground'?: string;
  'data-example'?: string;
  'data-query'?: string;
}

/**
 * Enhanced code block with optional playground integration.
 *
 * Usage in MDX:
 * ```ts playground
 * const builder = new SchemaBuilder({});
 * ```
 *
 * Or with example:
 * ```ts playground example="basic-types"
 * const builder = new SchemaBuilder({});
 * ```
 */
export function PlaygroundCodeBlock({
  exampleId: exampleIdProp,
  playground: playgroundProp,
  code,
  query: queryProp,
  children,
  'data-playground': dataPlayground,
  'data-example': dataExample,
  'data-query': dataQuery,
  ...props
}: PlaygroundCodeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use data attributes if props not provided (for native code blocks)
  const playground = playgroundProp ?? dataPlayground === 'true';
  const exampleId = exampleIdProp ?? dataExample;
  const query = queryProp ?? dataQuery;

  // Extract code content from children if not provided
  const codeContent = code || extractCodeContent(children);

  return (
    <>
      <CodeBlock
        {...props}
        // Mark blocks that carry the wide "Open in Playground" chip so the
        // toolbar band (which pushes code below the chip) is reserved ONLY for
        // them. Copy-only blocks skip the band and stay compact (global.css).
        className={[props.className, playground && 'has-playground']
          .filter(Boolean)
          .join(' ')}
        Actions={({ className, children: copyButton }) => (
          // Both actions are icon-only and share the top-right overlay
          // (`className` carries fumadocs' absolute positioning + backdrop, or
          // the header slot on titled blocks). Keeping the playground trigger
          // icon-sized — same weight as Copy — lets it tuck into the code's
          // right gutter instead of reserving a toolbar band that pushes the
          // code down. global.css widens that gutter on `has-playground`
          // blocks so neither icon ever sits over code text.
          <div className={`flex items-center gap-1 ${className || ''}`}>
            {playground && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-fd-muted-foreground text-xs transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
                title="Open in Playground"
                aria-label="Open in Playground"
              >
                <ExternalLink size={14} />
                <span>Playground</span>
              </button>
            )}
            {copyButton}
          </div>
        )}
      >
        <Pre>{children}</Pre>
      </CodeBlock>

      {/* Playground overlay (only rendered when expanded) */}
      {isExpanded && (
        <PlaygroundOverlay
          exampleId={exampleId}
          code={exampleId ? undefined : codeContent}
          query={query}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}

/**
 * Extract plain text code content from React children
 * Handles Shiki's syntax-highlighted structure which uses spans and preserves newlines
 */
function extractCodeContent(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(extractCodeContent).join('');
  }

  if (children && typeof children === 'object' && 'props' in children) {
    const element = children as { props: { children?: React.ReactNode; 'data-line'?: string } };

    // Handle Shiki's <span data-line> elements - each represents a line
    if (element.props['data-line'] !== undefined) {
      const lineContent = extractCodeContent(element.props.children);
      // Add newline after each line span (except the last one which is handled by caller)
      return `${lineContent}\n`;
    }

    // Recursively extract from other elements
    if (element.props.children) {
      return extractCodeContent(element.props.children);
    }
  }

  return '';
}
