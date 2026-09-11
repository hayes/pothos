import type { Metadata } from 'next';
import { Header } from '@/components/marketing/Header';
import { SponsorsPage } from '@/components/sponsors/SponsorsPage';

export const metadata: Metadata = {
  title: 'Sponsors & Contributors',
  description: 'The people and organizations who fund and contribute to Pothos GraphQL.',
};

export default function Page() {
  return (
    <div className="min-h-screen bg-bm-bg text-bm-ink">
      <Header />
      <SponsorsPage />
    </div>
  );
}
