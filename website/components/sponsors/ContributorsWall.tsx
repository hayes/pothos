import type { Contributor } from '../../lib/github';
import { PersonCard } from './PersonCard';

interface Props {
  contributors: Contributor[];
}

export function ContributorsWall({ contributors }: Props) {
  if (contributors.length === 0) {
    return (
      <p className="text-bm-ink-muted text-[14px] italic">
        Contributor data is currently unavailable.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-7">
      {contributors.map((c) => (
        <PersonCard
          key={c.login}
          login={c.login}
          avatarUrl={c.avatarUrl}
          htmlUrl={c.htmlUrl}
          size={56}
          detail={`${c.contributions} commit${c.contributions === 1 ? '' : 's'}`}
        />
      ))}
    </div>
  );
}
