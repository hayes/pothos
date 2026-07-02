import type { Metadata } from 'next';
import { PluginsPage } from '@/components/plugins/PluginsPage';

export const metadata: Metadata = {
  title: 'Plugins — Pothos',
  description:
    'First-party Pothos plugins for data, auth, schema patterns, live data, and developer experience.',
};

/**
 * /docs/plugins — keeps the docs Sidebar visible (you stay in the
 * docs section) but skips fumadocs's article grid so the plugin
 * overview can use its own wider layout.
 */
export default function Page() {
  return (
    <div className="max-w-[1200px] mx-auto px-8 py-12">
      <PluginsPage />
    </div>
  );
}
