import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/app/source';

export const { GET } = createFromSource(source);
