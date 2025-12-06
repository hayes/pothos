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
        Actions={
          playground
            ? ({ className }) => (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className={`hidden md:flex items-center gap-1.5 rounded-md border border-fd-border bg-fd-background/95 px-3 py-1.5 text-xs font-medium text-fd-muted-foreground backdrop-blur transition-colors hover:bg-fd-accent hover:text-fd-foreground ${className || ''}`}
                  title="Open in Playground (desktop only)"
                >
                  <ExternalLink size={12} />
                  Open in Playground
                </button>
              )
            : undefined
        }
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
