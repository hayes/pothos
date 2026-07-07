import type { Sponsor } from '@/lib/github';
import { PersonCard } from './PersonCard';
import { FALLBACK_SPONSOR_LOGINS } from './topSponsors';

interface Props {
  sponsors: Sponsor[];
}

/**
 * Grid of sponsor cards (avatar + name). When the GraphQL fetch comes
 * back empty (no token, or API failure) we fall back to a curated list
 * of GitHub handles so the page never looks empty.
 */
export function SponsorsWall({ sponsors }: Props) {
  const list = sponsors.length > 0 ? sponsors : fallbackList();
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-7">
      {list.map((s) => (
        <PersonCard
          key={s.login}
          login={s.login}
          name={s.name}
          avatarUrl={s.avatarUrl}
          htmlUrl={s.htmlUrl}
          size={64}
        />
      ))}
    </div>
  );
}

function fallbackList(): Sponsor[] {
  return FALLBACK_SPONSOR_LOGINS.map((login) => ({
    login,
    avatarUrl: `https://github.com/${login}.png?size=120`,
    htmlUrl: `https://github.com/${login}`,
  }));
}
