import type { Resource } from './resources';
import { SourceIcon } from './SourceIcon';

interface Props {
  resource: Resource;
}

/**
 * One link card on the resources page. Click anywhere → opens the
 * resource. Source icon + author render below the title; description
 * (when present) sits between them.
 */
export function ResourceCard({ resource }: Props) {
  const r = resource;
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noreferrer"
      className="group relative flex flex-col gap-2 px-5 py-4 border border-bm-line rounded-md transition-colors hover:bg-bm-surface hover:border-bm-ink-muted"
    >
      <div className="flex items-start gap-2">
        <span className="mt-[2px] text-bm-ink-muted group-hover:text-bm-accent transition-colors shrink-0">
          <SourceIcon source={r.source} />
        </span>
        <span className="font-medium text-[15px] text-bm-ink leading-[1.35]">{r.title}</span>
      </div>
      {r.description && (
        <p className="text-bm-ink-muted text-[13px] leading-[1.5] m-0">{r.description}</p>
      )}
      {r.author && (
        <div className="text-bm-ink-soft text-[12px] mt-1 font-mono">
          {r.authorUrl ? (
            <span>
              by{' '}
              <span className="text-bm-ink-soft group-hover:text-bm-ink transition-colors">
                {r.author}
              </span>
            </span>
          ) : (
            <span>by {r.author}</span>
          )}
        </div>
      )}
    </a>
  );
}
