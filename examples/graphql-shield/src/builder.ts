import SchemaBuilder from '@pothos/core';
import type { YogaInitialContext } from 'graphql-yoga';
import Plugin from './shield-plugin';

export interface Context extends YogaInitialContext {
  user: { id: number };
}

export const builder = new SchemaBuilder<{ Context: Context }>({
  plugins: [Plugin],
});
