import type { Contributor } from '../../lib/github';
import { SponsorAvatar } from './SponsorAvatar';

interface Props {
  contributors: Contributor[];
  /** Cap rendered avatars; the rest is summarized as "+N more". */
  maxShown?: number;
}

export function ContributorsWall({ contributors, maxShown = 60 }: Props) {
  if (contributors.length === 0) {
    return (
      <p className="text-bm-ink-muted text-[14px] italic">
        Contributor data is currently unavailable.
      </p>
    );
  }
  const shown = contributors.slice(0, maxShown);
  const remaining = Math.max(0, contributors.length - shown.length);
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((c) => (
        <SponsorAvatar
          key={c.login}
          login={c.login}
          avatarUrl={c.avatarUrl}
          htmlUrl={c.htmlUrl}
          size={44}
          detail={`${c.contributions} commit${c.contributions === 1 ? '' : 's'}`}
        />
      ))}
      {remaining > 0 && (
        <a
          href="https://github.com/hayes/pothos/graphs/contributors"
          target="_blank"
          rel="noreferrer"
          className="size-11 rounded-full inline-flex items-center justify-center bg-bm-surface-alt border border-bm-line text-bm-ink-soft hover:text-bm-ink hover:border-bm-accent transition-colors text-[12px] font-mono"
          title="See all contributors on GitHub"
        >
          +{remaining}
        </a>
      )}
    </div>
  );
}
