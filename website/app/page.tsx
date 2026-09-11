import type { Metadata } from 'next';
import { Header } from '../components/marketing/Header';
import { Hero } from '../components/marketing/Hero';
import { HeroBody } from '../components/marketing/HeroBody';
import { PluginGarden } from '../components/marketing/PluginGarden';
import { SchemaDesign } from '../components/marketing/SchemaDesign';
import { TrustedBy } from '../components/marketing/TrustedBy';

export const metadata: Metadata = {
  // `absolute` opts out of the root `%s — Pothos` template — this title
  // already leads with "Pothos GraphQL" and shouldn't gain a suffix.
  title: { absolute: 'Pothos GraphQL: Schemas that grow with your code' },
  description:
    'Pothos is a GraphQL schema builder for TypeScript with type safety built into every field. Write most of your schema without manual type annotations, with inference that extends to integrations like Prisma, Drizzle, and Zod.',
};

export default function HomePage() {
  return (
    <main className="bg-bm-bg text-bm-ink min-h-screen">
      <Header />
      <Hero />
      <HeroBody />
      <SchemaDesign />
      <PluginGarden />
      <TrustedBy />
    </main>
  );
}
