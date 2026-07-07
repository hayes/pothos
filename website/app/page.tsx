import type { Metadata } from 'next';
import { Header } from '../components/marketing/Header';
import { Hero } from '../components/marketing/Hero';
import { HeroBody } from '../components/marketing/HeroBody';
import { PluginGarden } from '../components/marketing/PluginGarden';
import { TrustedBy } from '../components/marketing/TrustedBy';

export const metadata: Metadata = {
  // `absolute` opts out of the root `%s — Pothos` template — this title
  // already leads with "Pothos GraphQL" and shouldn't gain a suffix.
  title: { absolute: 'Pothos GraphQL — Schemas that grow with your code' },
  description:
    'A plugin-based GraphQL schema builder for TypeScript. Build your schema with the builder and your types flow into every resolver — no codegen, no decorators.',
};

export default function HomePage() {
  return (
    <main className="bg-bm-bg text-bm-ink min-h-screen">
      <Header />
      <Hero />
      <HeroBody />
      <PluginGarden />
      <TrustedBy />
    </main>
  );
}
