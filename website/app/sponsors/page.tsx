import type { Metadata } from 'next';
import { Header } from '../../components/marketing/Header';
import { SponsorsPage } from '../../components/sponsors/SponsorsPage';

export const metadata: Metadata = {
  title: 'Sponsors & Contributors — Pothos',
  description:
    'The generous people and organizations supporting Pothos GraphQL development.',
};

export default function Page() {
  return (
    <div className="min-h-screen bg-bm-bg text-bm-ink">
      <Header />
      <SponsorsPage />
    </div>
  );
}
