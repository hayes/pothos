import type { Resource } from './resources';
import { SourceIcon } from './SourceIcon';

interface Props {
  resource: Resource;
}

/**
 * Resource card with separate destination, author, and introduction links.
 */
export function ResourceCard({ resource }: Props) {
  const r = resource;
  return (
    <article className="group relative flex flex-col gap-2 px-5 py-4 border border-bm-line rounded-md transition-colors hover:bg-bm-surface hover:border-bm-ink-muted">
      <a href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-2">
        <span className="mt-[2px] text-bm-ink-muted group-hover:text-bm-accent transition-colors shrink-0">
          <SourceIcon source={r.source} />
        </span>
        <span className="font-medium text-[15px] text-bm-ink leading-[1.35]">{r.title}</span>
      </a>
      {r.description && (
        <p className="text-bm-ink-muted text-[13px] leading-[1.5] m-0">{r.description}</p>
      )}
      {r.author && (
        <div className="text-bm-ink-soft text-[12px] mt-1 font-mono">
          by{' '}
          {r.authorUrl ? (
            <a href={r.authorUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {r.author}
            </a>
          ) : (
            r.author
          )}
        </div>
      )}
      {r.introductionUrl && (
        <a
          href={r.introductionUrl}
          target="_blank"
          rel="noreferrer"
          className="text-bm-accent text-[12px] hover:underline"
        >
          Introduction
        </a>
      )}
    </article>
  );
}
