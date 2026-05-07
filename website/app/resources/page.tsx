import type { Metadata } from 'next';
import { Header } from '../../components/marketing/Header';
import { ResourcesPage } from '../../components/resources/ResourcesPage';

export const metadata: Metadata = {
  title: 'Resources — Pothos',
  description:
    'Community articles, libraries, templates, and talks for building with Pothos GraphQL.',
};

export default function Page() {
  return (
    <div className="min-h-screen bg-bm-bg text-bm-ink">
      <Header />
      <ResourcesPage />
    </div>
  );
}
