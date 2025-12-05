'use client';

import { getExample } from './examples';
import { Playground } from './Playground';
import type { PlaygroundTab } from './types';

interface PlaygroundEmbedProps {
  example: string;
  defaultTab?: PlaygroundTab;
  height?: string;
}

export function PlaygroundEmbed({ example: exampleId, defaultTab, height }: PlaygroundEmbedProps) {
  const example = getExample(exampleId);

  if (!example) {
    return (
      <div className="my-6 rounded-lg border border-fd-border bg-fd-card p-4 text-fd-muted-foreground">
        Example "{exampleId}" not found
      </div>
    );
  }

  return <Playground example={example} defaultTab={defaultTab} height={height} />;
}
