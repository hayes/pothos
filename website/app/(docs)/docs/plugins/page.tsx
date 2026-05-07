import { redirect } from 'next/navigation';

/**
 * Canonicalize the plugins overview at /plugins. The MDX-based index
 * at content/docs/plugins/index.mdx is still pulled into the docs
 * pageTree (so the sidebar lists individual plugins), but the URL
 * `/docs/plugins` itself sends visitors to the redesigned overview.
 */
export default function PluginsRedirect(): never {
  redirect('/plugins');
}
