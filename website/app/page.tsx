import type { Metadata } from 'next';
import { Header } from '../components/marketing/Header';
import { Hero } from '../components/marketing/Hero';
import { HeroBody } from '../components/marketing/HeroBody';
import { PluginGarden } from '../components/marketing/PluginGarden';
import { TrustedBy } from '../components/marketing/TrustedBy';

export const metadata: Metadata = {
  title: 'Pothos GraphQL — Schemas that grow with your code',
  description:
    'A plugin-based GraphQL schema builder for TypeScript. Zero runtime overhead, no codegen, end-to-end inference.',
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
