/**
 * The wording mirrors the sentence the project has stood behind in
 * `README.md` and `content/docs/index.mdx` for years — "in use at some of
 * the largest tech companies including Airbnb and Netflix" — rather than a
 * flat "trusted in production by". The hedge is deliberate: this is
 * first-hand knowledge of internal usage, not something a reader can go and
 * verify, so the claim should read the same here as it does in the README.
 *
 * Only add a name to this list with a source you would be willing to show
 * the company in question. Four names that previously sat here (Linear,
 * Hashnode, Lyft, Tinybird) had none — and Hashnode's own engineering blog
 * documents them evaluating Pothos in 2022 and choosing SDL + codegen
 * instead, which is the kind of thing that turns a marketing band into an
 * argument.
 */
const COMPANIES = ['Airbnb', 'Netflix'];

export function TrustedBy() {
  return (
    <section className="border-t border-bm-line bg-bm-surface-alt py-14 px-10">
      <div className="max-w-[1280px] mx-auto flex items-center gap-14 flex-wrap">
        <span className="text-[12px] uppercase tracking-[0.08em] text-bm-ink-muted">
          In use at some of the largest tech companies, including
        </span>
        {COMPANIES.map((name) => (
          <span key={name} className="font-serif text-[22px] tracking-[-0.005em] text-bm-ink-soft">
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
