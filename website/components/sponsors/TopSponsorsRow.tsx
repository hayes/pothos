import { ThemedImage } from '../marketing/ThemedImage';
import { TOP_SPONSORS } from './topSponsors';

/**
 * 4-card row of curated top sponsors with logos, names, and blurbs.
 * Renders on a hairline grid (matches the home page's plugin-garden
 * pattern) so the cards read as part of the same family.
 */
export function TopSponsorsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-bm-line">
      {TOP_SPONSORS.map((s) => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col px-6 py-7 border-r border-b border-bm-line hover:bg-bm-surface transition-colors"
        >
          <div className="h-10 flex items-center mb-4">
            <ThemedImage
              src={s.logo}
              alt={`${s.name} logo`}
              className="max-h-10 max-w-[140px] opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <div className="font-medium text-[15px] mb-1">{s.name}</div>
          {s.blurb && (
            <div className="text-bm-ink-muted text-[13px] leading-[1.5]">{s.blurb}</div>
          )}
        </a>
      ))}
    </div>
  );
}
