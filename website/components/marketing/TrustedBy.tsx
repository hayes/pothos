const COMPANIES = ['Airbnb', 'Netflix'];

export function TrustedBy() {
  return (
    <section className="border-t border-bm-line bg-bm-surface-alt py-14 px-6 sm:px-10">
      <div className="max-w-[1280px] mx-auto flex items-center gap-6 sm:gap-14 flex-wrap">
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
