import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/app/source';

// The search index is built once at build time and served as a static file;
// the search dialog downloads it and runs the same Orama search in the browser.
// No server function runs, so this works on any static host.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);
