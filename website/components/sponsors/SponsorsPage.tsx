import { fetchContributors, fetchSponsors } from '../../lib/github';
import { ContributorsWall } from './ContributorsWall';
import { SponsorsWall } from './SponsorsWall';
import { TopSponsorsRow } from './TopSponsorsRow';

/**
 * Composed page body — top-tier sponsors as feature cards, then a wall
 * of community sponsors fetched from GitHub Sponsors, then a wall of
 * code contributors. All async data is fetched server-side with daily
 * revalidation; both walls degrade gracefully to a curated fallback
 * (sponsors) or an explanatory note (contributors) on API failure.
 */
export async function SponsorsPage() {
  const [sponsors, contributors] = await Promise.all([fetchSponsors(), fetchContributors()]);

  return (
    <div className="max-w-[1080px] mx-auto px-10 py-16">
      <header className="mb-10">
        <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-3">
          Sponsors &amp; Contributors
        </div>
        <h1
          className="font-serif font-normal m-0"
          style={{ fontSize: 48, letterSpacing: '-0.025em' }}
        >
          The garden tenders.
        </h1>
        <p className="text-bm-ink-soft text-[19px] leading-[1.5] max-w-[640px] mt-5">
          Pothos development is supported by these generous people and organizations. Want to
          help? <a href="https://github.com/sponsors/hayes" className="text-bm-accent hover:underline">Become a sponsor</a> or <a href="https://github.com/hayes/pothos" className="text-bm-accent hover:underline">contribute on GitHub</a>.
        </p>
      </header>

      <section className="mb-16">
        <SectionHead label="Top tier" />
        <TopSponsorsRow />
      </section>

      <section className="mb-16">
        <SectionHead label="GitHub sponsors" />
        <SponsorsWall sponsors={sponsors} />
      </section>

      <section>
        <SectionHead label="Contributors" />
        <ContributorsWall contributors={contributors} />
      </section>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <h2
      className="font-serif font-normal mb-5"
      style={{ fontSize: 24, letterSpacing: '-0.015em' }}
    >
      {label}
    </h2>
  );
}
