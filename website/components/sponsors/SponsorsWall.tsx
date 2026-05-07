import type { Sponsor } from '../../lib/github';
import { FALLBACK_SPONSOR_LOGINS } from './topSponsors';
import { SponsorAvatar } from './SponsorAvatar';

interface Props {
  sponsors: Sponsor[];
}

/**
 * Wall of avatars for the rest of the sponsors. When the GraphQL fetch
 * comes back empty (no token, or API failure) we render the curated
 * fallback list of GitHub handles instead, so the page never looks
 * empty.
 */
export function SponsorsWall({ sponsors }: Props) {
  const list = sponsors.length > 0 ? sponsors : fallbackList();
  return (
    <div className="flex flex-wrap gap-3">
      {list.map((s) => (
        <SponsorAvatar
          key={s.login}
          login={s.login}
          avatarUrl={s.avatarUrl}
          htmlUrl={s.htmlUrl}
          size={56}
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
