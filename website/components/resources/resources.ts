/**
 * Curated external resources for Pothos users — articles, libraries,
 * templates, talks, and paid tools built on top of `@pothos/core`. The
 * list is hand-maintained in this file (rather than dynamically
 * fetched) so the editorial ordering and categorization stays
 * intentional.
 */

export type ResourceCategory = 'guide' | 'tool' | 'template' | 'talk' | 'paid';

export interface Resource {
  /** Stable id used as React key. */
  id: string;
  category: ResourceCategory;
  title: string;
  /** Short, sentence-case summary. Optional — falls back to no body. */
  description?: string;
  url: string;
  /** Author / maintainer / channel. */
  author?: string;
  /** Optional author URL — linked separately from the title. */
  authorUrl?: string;
  /** ISO date when discoverable, used for sorting + display. */
  date?: string;
  /** Hosting platform for visual hint (github, youtube, blog, etc.). */
  source?: 'github' | 'youtube' | 'blog' | 'docs' | 'npm';
}

export const CATEGORY_META: Record<
  ResourceCategory,
  { label: string; eyebrow: string; description: string }
> = {
  guide: {
    label: 'Guides & tutorials',
    eyebrow: 'Read',
    description: 'Walkthroughs and articles on building real apps with Pothos.',
  },
  tool: {
    label: 'Tools & libraries',
    eyebrow: 'Build',
    description: 'Codegen, codemods, and integrations that extend the schema builder.',
  },
  template: {
    label: 'Templates & examples',
    eyebrow: 'Start',
    description: 'Starter repos and reference implementations to fork from.',
  },
  talk: {
    label: 'Talks & videos',
    eyebrow: 'Watch',
    description: 'Conference talks, screencasts, and walkthrough videos.',
  },
  paid: {
    label: 'Paid tools',
    eyebrow: 'Ship',
    description: 'Commercial products built on top of Pothos.',
  },
};

export const RESOURCES: Resource[] = [
  // ── Guides ─────────────────────────────────────────────────────────
  {
    id: 'guide-tigawanna-2025',
    category: 'guide',
    title: 'Revisiting GraphQL in 2025: A Type-Safe Stack with Pothos and Relay',
    description:
      'Long-form walkthrough of Pothos + Prisma + GraphQL Yoga + Relay client. Pairs with the frens companion repo below.',
    url: 'https://dev.to/tigawanna/revisiting-graphql-in-2025-a-type-safe-stack-with-pothos-and-relay-ka8',
    author: 'Dennis Kinuthia',
    authorUrl: 'https://github.com/tigawanna',
    date: '2025-04-15',
    source: 'blog',
  },
  {
    id: 'guide-prisma-e2e',
    category: 'guide',
    title: 'End-to-End Type-Safety with GraphQL, Prisma & React',
    url: 'https://www.prisma.io/blog/e2e-type-safety-graphql-react-3-fbV2ZVIGWg#start-up-a-graphql-server',
    author: 'Sabin Adams',
    authorUrl: 'https://twitter.com/sabinthedev',
    source: 'blog',
  },
  {
    id: 'guide-graphql-wtf',
    category: 'guide',
    title: 'Code-first GraphQL with Pothos',
    url: 'https://graphql.wtf/episodes/60-code-first-graphql-with-pothos',
    author: 'Jamie Barton',
    authorUrl: 'https://twitter.com/notrab',
    source: 'blog',
  },
  {
    id: 'guide-kysely',
    category: 'guide',
    title: 'How to Build a Type-safe GraphQL API using Pothos and Kysely',
    url: 'https://dev.to/franciscomendes10866/how-to-build-a-type-safe-graphql-api-using-pothos-and-kysely-4ja3',
    author: 'Francisco Mendes',
    authorUrl: 'https://github.com/FranciscoMendes10866',
    source: 'blog',
  },
  {
    id: 'guide-omkar',
    category: 'guide',
    title: 'Type-safe GraphQL Server with Pothos',
    url: 'https://omkarkulkarni.hashnode.dev/type-safe-graphql-server-with-pothos-formerly-giraphql',
    author: 'Omkar Kulkarni',
    authorUrl: 'https://twitter.com/omkar_k45',
    source: 'blog',
  },
  {
    id: 'guide-cf-yoga',
    category: 'guide',
    title: 'Build a GraphQL server running on Cloudflare Workers',
    url: 'https://the-guild.dev/blog/graphql-yoga-worker',
    author: 'Rito Tamata',
    authorUrl: 'https://twitter.com/chimame_rt',
    source: 'blog',
  },

  // ── Tools & Libraries ─────────────────────────────────────────────
  {
    id: 'tool-prisma-codegen',
    category: 'tool',
    title: 'Prisma Generator Pothos Codegen',
    description: 'Generate Pothos types and inputs directly from a Prisma schema.',
    url: 'https://github.com/Cauen/prisma-generator-pothos-codegen',
    author: 'Emanuel',
    authorUrl: 'https://twitter.com/cauenor',
    source: 'github',
  },
  {
    id: 'tool-nexus-codemod',
    category: 'tool',
    title: 'Nexus to Pothos codemod',
    description: 'Migrate an existing Nexus schema to Pothos automatically.',
    url: 'https://github.com/villesau/nexus-to-pothos-codemod',
    author: 'Ville Saukkonen',
    authorUrl: 'https://twitter.com/SaukkonenVille',
    source: 'github',
  },
  {
    id: 'tool-protoc-gen-pothos',
    category: 'tool',
    title: 'protoc-gen-pothos',
    description: 'Generate Pothos types from Protobuf service definitions.',
    url: 'https://github.com/proto-graphql/proto-graphql-js/tree/main/packages/protoc-gen-pothos',
    author: 'Masayuki Izumi',
    authorUrl: 'https://twitter.com/izumin5210',
    source: 'github',
  },
  {
    id: 'tool-nestjs-pothos',
    category: 'tool',
    title: '@smatch-corp/nestjs-pothos',
    description: 'NestJS module that integrates Pothos into Nest applications.',
    url: 'https://github.com/smatch-corp/nestjs-pothos',
    author: 'Chanhee Lee',
    authorUrl: 'https://github.com/iamchanii',
    source: 'github',
  },
  {
    id: 'tool-pothos-protoc-gen',
    category: 'tool',
    title: 'pothos-protoc-gen',
    description: 'Alternate Protobuf-to-Pothos code generator.',
    url: 'https://iamchanii.github.io/pothos-protoc-gen/',
    author: 'Chanhee Lee',
    authorUrl: 'https://github.com/iamchanii',
    source: 'docs',
  },
  {
    id: 'tool-rumble',
    category: 'tool',
    title: 'rumble — Pothos + Drizzle + Abilities',
    description: 'Drop-in CASL-style authorization for Pothos schemas powered by Drizzle.',
    url: 'https://github.com/m1212e/rumble',
    author: 'm1212e',
    authorUrl: 'https://github.com/m1212e',
    source: 'github',
  },
  {
    id: 'tool-prisma-generator-soracumo',
    category: 'tool',
    title: 'pothos-prisma-generator',
    description: 'Alternative Pothos schema generator from a Prisma schema, actively maintained.',
    url: 'https://github.com/node-libraries/pothos-prisma-generator',
    author: 'SoraKumo',
    authorUrl: 'https://github.com/SoraKumo001',
    source: 'github',
  },
  {
    id: 'tool-awesome-pothos',
    category: 'tool',
    title: 'awesome-pothos-graphql',
    description: 'Community-curated list of Pothos resources.',
    url: 'https://github.com/fcanela/awesome-pothos-graphql',
    author: 'Francisco Canela',
    authorUrl: 'https://github.com/fcanela',
    source: 'github',
  },

  // ── Templates & Examples ──────────────────────────────────────────
  {
    id: 'tpl-nkzw-server',
    category: 'template',
    title: 'Server Template with Pothos',
    description: 'Production-grade Pothos + Yoga server template from Nakazawa Tech.',
    url: 'https://github.com/nkzw-tech/server-template',
    author: 'Nakazawa Tech',
    authorUrl: 'https://nakazawa.tech',
    source: 'github',
  },
  {
    id: 'tpl-theogravity',
    category: 'template',
    title: 'Pothos GraphQL Server',
    description: 'Reference implementation with Apollo Server, Prisma, and DataLoader.',
    url: 'https://github.com/theogravity/graphql-pothos-server-example',
    author: 'Theo Gravity',
    authorUrl: 'https://github.com/theogravity',
    source: 'github',
  },
  {
    id: 'tpl-countries',
    category: 'template',
    title: 'GraphQL countries server',
    description: 'Tiny Pothos server returning country data — a focused starter.',
    url: 'https://github.com/gbicou/countries-server',
    author: 'Benjamin VIELLARD',
    authorUrl: 'https://github.com/gbicou',
    source: 'github',
  },
  {
    id: 'tpl-datalake',
    category: 'template',
    title: 'datalake-graphql-wrapper',
    description: 'Wraps a relational data lake as a Pothos GraphQL endpoint.',
    url: 'https://github.com/dbsystel/datalake-graphql-wrapper',
    author: 'noxify',
    authorUrl: 'https://github.com/noxify',
    source: 'github',
  },
  {
    id: 'tpl-frens',
    category: 'template',
    title: 'frens — full-stack social app',
    description:
      'End-to-end reference: Pothos, Prisma, GraphQL Yoga, Better Auth, Relay client. Companion to the "Revisiting GraphQL 2025" article above.',
    url: 'https://github.com/tigawanna/frens',
    author: 'Dennis Kinuthia',
    authorUrl: 'https://github.com/tigawanna',
    source: 'github',
  },
  {
    id: 'tpl-serieslist',
    category: 'template',
    title: 'serieslist — Pothos + Drizzle in production',
    description: 'Series-tracker app using Pothos, Drizzle, Fastify, GraphQL Yoga, and React SSR.',
    url: 'https://github.com/JoosepAlviste/serieslist',
    author: 'Joosep Alviste',
    authorUrl: 'https://github.com/JoosepAlviste',
    source: 'github',
  },

  // ── Talks ─────────────────────────────────────────────────────────
  {
    id: 'talk-pothos-prisma',
    category: 'talk',
    title: 'Pothos + Prisma: delightful, type-safe and efficient GraphQL',
    url: 'https://www.youtube.com/watch?v=LqKPfMmxFxw',
    author: 'Michael Hayes',
    authorUrl: 'https://twitter.com/yavascript',
    source: 'youtube',
  },
  {
    id: 'talk-scalable-apps',
    category: 'talk',
    title: 'Building Scalable Applications',
    url: 'https://www.youtube.com/watch?v=rxPTEko8J7c&t=36s',
    author: 'Christoph Nakazawa',
    authorUrl: 'https://cpojer.net',
    source: 'youtube',
  },

  // ── Paid tools ────────────────────────────────────────────────────
  {
    id: 'paid-bedrock',
    category: 'paid',
    title: 'Bedrock',
    description: 'A full-stack TypeScript boilerplate with Pothos baked in.',
    url: 'https://bedrock.mxstbr.com/',
    author: 'Max Stoiber',
    authorUrl: 'https://twitter.com/mxstbr',
    source: 'docs',
  },
  {
    id: 'paid-nytro',
    category: 'paid',
    title: 'nytro',
    description: 'Hosted GraphQL infrastructure with native Pothos support.',
    url: 'https://www.nytro.dev/',
    author: 'Jordan Gensler',
    authorUrl: 'https://twitter.com/vapejuicejordan',
    source: 'docs',
  },
];

export function resourcesByCategory(): Record<ResourceCategory, Resource[]> {
  const grouped: Record<ResourceCategory, Resource[]> = {
    guide: [],
    tool: [],
    template: [],
    talk: [],
    paid: [],
  };
  for (const r of RESOURCES) grouped[r.category].push(r);
  return grouped;
}
