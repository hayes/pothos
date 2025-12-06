'use client';

import { Pre } from 'fumadocs-ui/components/codeblock';
import { PlaygroundCodeBlock } from '../code-snippet/PlaygroundCodeBlock';
import { getExample } from './examples';

interface PlaygroundEmbedProps {
  example: string;
}

/**
 * Lightweight embedded playground for MDX documentation.
 * Shows static code with syntax highlighting and "Open in Playground" button.
 * Only loads the full playground (Monaco/esbuild/GraphiQL) when user clicks to expand.
 *
 * @example
 * ```mdx
 * <PlaygroundEmbed example="basic-types" />
 * <PlaygroundEmbed example="mutations" />
 * ```
 */
export function PlaygroundEmbed({ example: exampleId }: PlaygroundEmbedProps) {
  const example = getExample(exampleId);

  if (!example) {
    return (
      <div className="my-6 rounded-lg border border-fd-border bg-fd-card p-4 text-fd-muted-foreground">
        Example "{exampleId}" not found
      </div>
    );
  }

  // Get the main schema file content
  const mainFile = example.files.find((f) => f.filename === 'schema.ts') || example.files[0];

  return (
    <div className="my-6">
      <PlaygroundCodeBlock
        lang="typescript"
        exampleId={exampleId}
        playground={true}
        code={mainFile.content}
        title={example.title}
      >
        <Pre>
          <code>{mainFile.content}</code>
        </Pre>
      </PlaygroundCodeBlock>
    </div>
  );
}
