import Link from 'next/link';

const FEATURES = [
  {
    title: 'Database integration',
    description:
      'Build fields backed by Prisma or Drizzle, with queries shaped by the requested GraphQL fields.',
    links: [
      { label: 'Prisma', slug: 'prisma' },
      { label: 'Drizzle', slug: 'drizzle' },
    ],
  },
  {
    title: 'Authorization',
    description: 'Define access checks on your types and fields using request context.',
    links: [{ label: 'Scope Auth', slug: 'scope-auth' }],
  },
  {
    title: 'Pagination',
    description: 'Add cursor-based connections and globally identifiable nodes.',
    links: [{ label: 'Relay', slug: 'relay' }],
  },
  {
    title: 'Batching',
    description: 'Batch data loading across resolvers to avoid fetching each item separately.',
    links: [{ label: 'Dataloader', slug: 'dataloader' }],
  },
];

export function PluginGarden() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 sm:px-10 pb-20">
      <div className="border-t border-bm-line pt-12">
        <h2 className="font-serif font-normal m-0 mb-5 text-[clamp(32px,4vw,48px)] leading-tight tracking-tight">
          Plugins extend the builder
        </h2>
        <p className="text-bm-ink-soft text-[17px] leading-relaxed max-w-3xl mt-0 mb-10">
          Add authorization, pagination, or database integration where you define your fields.
          Plugin options have access to the same parent, argument, and context types as your
          resolvers.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-bm-line">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="p-8 border-r border-b border-bm-line">
              <h3 className="font-medium text-[19px] m-0 mb-3">{feature.title}</h3>
              <p className="text-bm-ink-soft text-[16px] leading-relaxed m-0 mb-5 max-w-md">
                {feature.description}
              </p>
              <div className="flex gap-6">
                {feature.links.map((link) => (
                  <Link
                    key={link.slug}
                    href={`/docs/plugins/${link.slug}`}
                    className="text-bm-accent text-[15px] hover:underline"
                  >
                    {link.label} <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/docs/plugins"
          className="inline-block mt-7 text-bm-ink-soft hover:text-bm-ink text-[15px]"
        >
          Explore all plugins <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
