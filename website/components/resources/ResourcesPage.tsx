import { ResourceCard } from './ResourceCard';
import { CATEGORY_META, type ResourceCategory, resourcesByCategory } from './resources';

const SECTION_ORDER: ResourceCategory[] = ['guide', 'tool', 'template', 'talk', 'paid'];

export function ResourcesPage() {
  const grouped = resourcesByCategory();
  return (
    <div className="max-w-[1080px] mx-auto px-10 py-16">
      <header className="mb-12">
        <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-3">Resources</div>
        <h1
          className="font-serif font-normal m-0"
          style={{ fontSize: 48, letterSpacing: '-0.025em' }}
        >
          Learn from the community.
        </h1>
        <p className="text-bm-ink-soft text-[19px] leading-[1.5] max-w-[640px] mt-5">
          Curated articles, libraries, templates, and talks from people building real things with
          Pothos. Have something to add?{' '}
          <a
            href="https://github.com/hayes/pothos/edit/main/website/components/resources/resources.ts"
            className="text-bm-accent hover:underline"
          >
            Open a PR
          </a>
          .
        </p>
      </header>

      <div className="flex flex-col gap-16">
        {SECTION_ORDER.map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) {
            return null;
          }
          const meta = CATEGORY_META[cat];
          return (
            <section key={cat}>
              <header className="mb-6">
                <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-2">
                  {meta.eyebrow}
                </div>
                <h2
                  className="font-serif font-normal m-0 mb-2"
                  style={{ fontSize: 28, letterSpacing: '-0.02em' }}
                >
                  {meta.label}
                </h2>
                <p className="text-bm-ink-muted text-[14px] m-0">{meta.description}</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((r) => (
                  <ResourceCard key={r.id} resource={r} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
