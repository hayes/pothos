import type { Metadata } from 'next';
import { Header } from '@/components/marketing/Header';
import { PluginsPage } from '@/components/plugins/PluginsPage';

export const metadata: Metadata = {
  title: 'Plugins — Pothos',
  description:
    'First-party Pothos plugins for data, auth, schema patterns, live data, and developer experience.',
};

export default function Page() {
  return (
    <div className="min-h-screen bg-bm-bg text-bm-ink">
      <Header />
      <PluginsPage />
    </div>
  );
}
