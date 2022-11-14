import { YogaInitialContext } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';
import Plugin from './shield-plugin';

export interface Context extends YogaInitialContext {
  user: { id: number };
}

export const builder = new SchemaBuilder<{ Context: Context }>({
  plugins: [Plugin],
});
